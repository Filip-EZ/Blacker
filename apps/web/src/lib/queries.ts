import { schema } from '@blacker/core/db';
import { and, desc, eq, gte, inArray, isNotNull, ne, sql, type SQL } from 'drizzle-orm';
import { getDb } from './db';
import type { DealFilters } from './filters';

const { deals, products, shops, priceSnapshots, sourceRuns } = schema;

const PERIOD_MS = { '24h': 86_400_000, live: 7_200_000 } as const;
const ACTIVE = ['new', 'starred'] as const;

function where(f: DealFilters): SQL | undefined {
  return and(
    f.view === 'active' ? inArray(deals.status, [...ACTIVE]) : eq(deals.status, f.view === 'starred' ? 'starred' : 'hidden'),
    f.category ? eq(deals.aiCategory, f.category) : undefined,
    f.shop ? eq(shops.name, f.shop) : undefined,
    f.tier !== 'all' ? eq(products.tier, f.tier) : undefined,
    f.minDiscount ? gte(deals.realDiscountPct, f.minDiscount) : undefined,
    f.verdict === 'super' ? eq(deals.aiVerdict, 'super') : undefined,
    f.verdict === 'good' ? inArray(deals.aiVerdict, ['super', 'ok']) : undefined,
    f.verdict === 'clean' ? sql`${deals.aiVerdict} is distinct from 'podejrzane'` : undefined,
    f.period !== 'all' ? gte(deals.detectedAt, new Date(Date.now() - PERIOD_MS[f.period])) : undefined,
  );
}

const ORDER = {
  score: [desc(deals.score), desc(deals.detectedAt)],
  discount: [sql`${deals.realDiscountPct} desc nulls last`, desc(deals.score)],
  new: [desc(deals.detectedAt), desc(deals.score)],
  price: [deals.price, desc(deals.score)],
};

export async function listDeals(f: DealFilters, limit = 120) {
  return getDb()
    .select({
      id: deals.id,
      price: deals.price,
      referencePrice: deals.referencePrice,
      realDiscountPct: deals.realDiscountPct,
      score: deals.score,
      flags: deals.flags,
      temperature: deals.temperature,
      inStock: deals.inStock,
      status: deals.status,
      detectedAt: deals.detectedAt,
      aiVerdict: deals.aiVerdict,
      aiSummary: deals.aiSummary,
      aiCategory: deals.aiCategory,
      title: products.title,
      url: products.url,
      image: products.image,
      tier: products.tier,
      shop: shops.name,
    })
    .from(deals)
    .innerJoin(products, eq(deals.productId, products.id))
    .innerJoin(shops, eq(products.shopId, shops.id))
    .where(where(f))
    .orderBy(...ORDER[f.sort])
    .limit(limit);
}

export type DealRow = Awaited<ReturnType<typeof listDeals>>[number];

/** Global numbers for the header tiles; deliberately not filtered. */
export async function summary() {
  const db = getDb();
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [[counts], [last]] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*)::int`,
        superCount: sql<number>`(count(*) filter (where ${deals.aiVerdict} = 'super'))::int`,
        newToday: sql<number>`(count(*) filter (where ${deals.detectedAt} >= ${dayAgo.toISOString()}))::int`,
      })
      .from(deals)
      .where(inArray(deals.status, [...ACTIVE])),
    db.select({ at: sql<string | null>`max(${sourceRuns.startedAt})` }).from(sourceRuns).where(eq(sourceRuns.ok, true)),
  ]);
  return { ...counts, lastRun: last?.at ? new Date(last.at) : null };
}

/** Options for the filter dropdowns, most common first. */
export async function filterOptions() {
  const db = getDb();
  const active = inArray(deals.status, [...ACTIVE]);
  const [categories, shopList] = await Promise.all([
    db
      .select({ name: deals.aiCategory, n: sql<number>`count(*)::int` })
      .from(deals)
      .where(and(active, isNotNull(deals.aiCategory)))
      .groupBy(deals.aiCategory)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ name: shops.name, n: sql<number>`count(*)::int` })
      .from(deals)
      .innerJoin(products, eq(deals.productId, products.id))
      .innerJoin(shops, eq(products.shopId, shops.id))
      .where(active)
      .groupBy(shops.name)
      .orderBy(desc(sql`count(*)`))
      .limit(60),
  ]);
  return {
    categories: categories.flatMap((c) => (c.name ? [{ name: c.name, n: c.n }] : [])),
    shops: shopList,
  };
}

export async function getDeal(id: number) {
  const db = getDb();
  const [row] = await db
    .select({ deal: deals, product: products, shop: shops.name })
    .from(deals)
    .innerJoin(products, eq(deals.productId, products.id))
    .innerJoin(shops, eq(products.shopId, shops.id))
    .where(eq(deals.id, id));
  if (!row) return undefined;
  const history = await db
    .select({
      price: priceSnapshots.price,
      regularPrice: priceSnapshots.regularPrice,
      omnibusLow30d: priceSnapshots.omnibusLow30d,
      inStock: priceSnapshots.inStock,
      fetchedAt: priceSnapshots.fetchedAt,
    })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.productId, row.product.id))
    .orderBy(priceSnapshots.fetchedAt)
    .limit(2000);
  return { ...row, history };
}

export type DealDetail = NonNullable<Awaited<ReturnType<typeof getDeal>>>;

/** Latest run and 24 h success rate per source, for the health page. */
export async function sourceHealth() {
  const db = getDb();
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [stats, latest] = await Promise.all([
    db
      .select({
        sourceId: sourceRuns.sourceId,
        runs: sql<number>`count(*)::int`,
        ok: sql<number>`(count(*) filter (where ${sourceRuns.ok}))::int`,
      })
      .from(sourceRuns)
      .where(gte(sourceRuns.startedAt, dayAgo))
      .groupBy(sourceRuns.sourceId),
    db
      .selectDistinctOn([sourceRuns.sourceId], {
        sourceId: sourceRuns.sourceId,
        ok: sourceRuns.ok,
        offers: sourceRuns.offers,
        error: sourceRuns.error,
        startedAt: sourceRuns.startedAt,
        durationMs: sourceRuns.durationMs,
      })
      .from(sourceRuns)
      .orderBy(sourceRuns.sourceId, desc(sourceRuns.startedAt)),
  ]);
  const lastOk = await db
    .select({ sourceId: sourceRuns.sourceId, at: sql<string>`max(${sourceRuns.startedAt})` })
    .from(sourceRuns)
    .where(eq(sourceRuns.ok, true))
    .groupBy(sourceRuns.sourceId);
  return latest.map((l) => {
    const s = stats.find((x) => x.sourceId === l.sourceId);
    const ok = lastOk.find((x) => x.sourceId === l.sourceId);
    return { ...l, runs24h: s?.runs ?? 0, ok24h: s?.ok ?? 0, lastOk: ok ? new Date(ok.at) : null };
  });
}

/** Status changes from the dashboard: star, hide, restore. Expired deals stay expired. */
export async function setDealStatus(id: number, status: 'new' | 'starred' | 'hidden') {
  await getDb().update(deals).set({ status }).where(and(eq(deals.id, id), ne(deals.status, 'expired')));
}
