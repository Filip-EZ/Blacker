import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Settings } from './config';
import type { Db } from './db';
import { deals, priceSnapshots, products, shops, sourceRuns } from './db/schema';
import { computeHistory, shouldSnapshot, type SnapshotPoint } from './history';
import { scoreOffer, type Score } from './scoring';
import type { RawOffer, SourceConfig } from './types';

const CHUNK = 500;
const DAY = 86_400_000;

/** Runs fn per chunk to stay under Postgres' bind-parameter limit; concatenates results. */
async function inChunks<T, R = never>(items: T[], fn: (chunk: T[]) => Promise<R[] | void>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(...((await fn(items.slice(i, i + CHUNK))) ?? []));
  return out;
}

export interface SaveStats {
  offers: number;
  snapshots: number;
  deals: number;
}

/** Saves one source's offers: products, price snapshots (only on change) and scored deals. */
export async function saveOffers(db: Db, source: SourceConfig, offers: RawOffer[], settings: Settings): Promise<SaveStats> {
  const unique = [...new Map(offers.map((o) => [o.url, o])).values()];
  if (!unique.length) return { offers: 0, snapshots: 0, deals: 0 };
  const now = new Date();

  const shopRows = await db
    .insert(shops)
    .values([...new Map(unique.map((o) => [o.shopName, { name: o.shopName, domain: o.shopDomain }])).values()])
    .onConflictDoUpdate({ target: shops.name, set: { domain: sql`excluded.domain` } })
    .returning({ id: shops.id, name: shops.name });
  const shopId = new Map(shopRows.map((s) => [s.name, s.id]));

  const productRows = await inChunks(unique, (chunk) =>
    db
      .insert(products)
      .values(chunk.map((o) => ({
        shopId: shopId.get(o.shopName)!,
        sourceId: source.id,
        tier: source.tier,
        url: o.url,
        title: o.title,
        category: o.category,
        gtin: o.gtin,
        image: o.image,
      })))
      .onConflictDoUpdate({
        target: products.url,
        set: {
          title: sql`excluded.title`,
          sourceId: sql`excluded.source_id`,
          lastSeen: now,
          image: sql`coalesce(excluded.image, ${products.image})`,
          category: sql`coalesce(excluded.category, ${products.category})`,
          gtin: sql`coalesce(excluded.gtin, ${products.gtin})`,
        },
      })
      .returning({ id: products.id, url: products.url }),
  );
  const productId = new Map(productRows.map((p) => [p.url, p.id]));
  const ids = [...productId.values()];

  // 60 days: the 30-day baseline is anchored at the start of the current price run, which can be in the past.
  const history = await inChunks(ids, (chunk) =>
    db
      .select({ productId: priceSnapshots.productId, price: priceSnapshots.price, inStock: priceSnapshots.inStock, fetchedAt: priceSnapshots.fetchedAt })
      .from(priceSnapshots)
      .where(and(inArray(priceSnapshots.productId, chunk), gte(priceSnapshots.fetchedAt, new Date(now.getTime() - 60 * DAY)))),
  );
  const byProduct = Map.groupBy(history, (h) => h.productId);

  const snapshotRows: (typeof priceSnapshots.$inferInsert)[] = [];
  const scored: { id: number; offer: RawOffer; score: Score }[] = [];
  for (const offer of unique) {
    const id = productId.get(offer.url)!;
    const snaps = byProduct.get(id) ?? [];
    const last = snaps.reduce<(typeof snaps)[number] | undefined>((a, b) => (!a || b.fetchedAt > a.fetchedAt ? b : a), undefined);
    if (shouldSnapshot(last, offer, now)) {
      snapshotRows.push({
        productId: id,
        price: offer.price,
        regularPrice: offer.regularPrice,
        omnibusLow30d: offer.omnibusLow30d,
        inStock: offer.inStock,
        temperature: offer.temperature,
      });
    }
    scored.push({ id, offer, score: scoreOffer(offer, computeHistory(snaps as SnapshotPoint[], offer.price, now)) });
  }
  if (snapshotRows.length) await inChunks(snapshotRows, async (chunk) => { await db.insert(priceSnapshots).values(chunk); });

  const keep = scored.filter((s) => s.score.score >= settings.minScoreToStore);
  const drop = scored.filter((s) => s.score.score < settings.minScoreToStore).map((s) => s.id);

  if (keep.length) {
    await inChunks(keep, async (chunk) => {
      await db
        .insert(deals)
        .values(chunk.map(({ id, offer, score }) => ({
          productId: id,
          price: offer.price,
          referencePrice: score.referencePrice,
          realDiscountPct: score.realDiscountPct,
          score: score.score,
          flags: score.flags,
          temperature: offer.temperature,
          inStock: offer.inStock,
          endsAt: offer.endsAt,
        })))
        .onConflictDoUpdate({
          target: deals.productId,
          set: {
            // A new price is a new deal moment; the same price keeps its original detection time.
            detectedAt: sql`case when ${deals.price} <> excluded.price then now() else ${deals.detectedAt} end`,
            // Expired deals come back; hidden ones only if the price dropped further.
            status: sql`case when ${deals.status} = 'expired' or (${deals.status} = 'hidden' and excluded.price < ${deals.price}) then 'new' else ${deals.status} end`,
            price: sql`excluded.price`,
            referencePrice: sql`excluded.reference_price`,
            realDiscountPct: sql`excluded.real_discount_pct`,
            score: sql`excluded.score`,
            flags: sql`excluded.flags`,
            temperature: sql`excluded.temperature`,
            inStock: sql`excluded.in_stock`,
            endsAt: sql`excluded.ends_at`,
            updatedAt: now,
          },
        });
    });
  }
  if (drop.length) {
    await inChunks(drop, async (chunk) => {
      await db.update(deals).set({ status: 'expired', updatedAt: now }).where(and(inArray(deals.productId, chunk), eq(deals.status, 'new')));
    });
  }

  return { offers: unique.length, snapshots: snapshotRows.length, deals: keep.length };
}

/** Deals that stopped appearing in any feed (e.g. Pepper threads that fell off) or whose promo ended. */
export async function expireStale(db: Db, maxAgeHours = 48) {
  const now = new Date();
  await db
    .update(deals)
    .set({ status: 'expired', updatedAt: now })
    .where(and(eq(deals.status, 'new'), sql`(${deals.updatedAt} < ${new Date(now.getTime() - maxAgeHours * 3_600_000)} or ${deals.endsAt} < ${now})`));
}

export async function recordRun(db: Db, run: typeof sourceRuns.$inferInsert) {
  await db.insert(sourceRuns).values(run);
}

export async function pruneRuns(db: Db, days = 14) {
  await db.delete(sourceRuns).where(lt(sourceRuns.startedAt, new Date(Date.now() - days * DAY)));
}
