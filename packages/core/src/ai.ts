import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Settings } from './config';
import { envValue } from './env';
import type { Db } from './db';
import { deals, products, shops } from './db/schema';

export const AI_MODEL = 'claude-haiku-5-5';

export const CATEGORIES = [
  'Elektronika i RTV',
  'Komputery i gaming',
  'Telefony i akcesoria',
  'AGD',
  'Dom i ogród',
  'Moda',
  'Zabawki i LEGO',
  'Sport i turystyka',
  'Uroda i zdrowie',
  'Motoryzacja',
  'Spożywcze',
  'Usługi i subskrypcje',
  'Inne',
] as const;

const Review = z.object({
  id: z.number().int(),
  verdict: z.enum(['super', 'ok', 'słabe', 'podejrzane']),
  category: z.enum(CATEGORIES),
  summary: z.string().describe('Jedno krótkie zdanie po polsku: co to jest i dlaczego warto (lub nie).'),
  reason: z.string().describe('Krótkie uzasadnienie werdyktu po polsku, maks. 2 zdania.'),
});
const Reviews = z.object({ reviews: z.array(Review) });
export type AiReview = z.infer<typeof Review>;

const fold = (s: string) => s.normalize('NFC').toLocaleLowerCase('pl').trim();

/** Maps an off-list category (other case, stray whitespace, invented name) onto the fixed list, falling back to "Inne". */
export function normalizeCategory(raw: unknown): AiReview['category'] {
  const key = typeof raw === 'string' ? fold(raw) : '';
  return CATEGORIES.find((c) => fold(c) === key) ?? 'Inne';
}

/** Validates reviews one by one, so a single malformed entry does not discard the whole batch. */
export function parseReviews(text: string): AiReview[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const items = (data as { reviews?: unknown })?.reviews;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const r = Review.safeParse({ ...(item as object), category: normalizeCategory((item as { category?: unknown })?.category) });
    return r.success ? [r.data] : [];
  });
}

export interface Candidate {
  id: number;
  title: string;
  shop: string;
  price: number;
  referencePrice: number | null;
  realDiscountPct: number | null;
  temperature: number | null;
  flags: string[];
  category: string | null;
  inStock: boolean | null;
}

const SYSTEM = `Oceniasz promocje z polskich sklepów internetowych w okresie Black Week.
Dla każdej oferty zdecyduj, czy to naprawdę dobra okazja dla przeciętnego kupującego w Polsce.

Dane o ofercie:
- price: cena teraz (PLN). referencePrice: zweryfikowana cena odniesienia (najniższa z 30 dni wg Omnibus albo naszej historii).
- realDiscountPct: realny rabat względem referencePrice. temperature: głosy społeczności Pepper.pl (100+ dobra, 500+ bardzo gorąca).
- flags: no-baseline (brak weryfikacji, tylko cena przekreślona sklepu), raised-before-promo (cenę podniesiono przed promocją),
  possible-price-error (rabat tak duży, że to może być błąd cenowy lub oszustwo), out-of-stock.

Werdykty:
- super: wyraźnie najlepsza cena od dawna, rzecz warta kupienia, realny rabat duży lub bardzo gorąca na Pepper.
- ok: przyzwoita cena, ale bez rewelacji.
- słabe: rabat pozorny lub mały, produkt niszowy albo przeciętny, cena typowa.
- podejrzane: ryzyko oszustwa, nieznany sprzedawca z nierealną ceną, manipulacja ceną odniesienia.

Bierz pod uwagę wiedzę o typowych cenach produktów, ale nie zmyślaj konkretnych liczb. Pisz zwięźle, po polsku.
Zwróć recenzję dla każdego id z wejścia.`;

export function createAiClient() {
  return new Anthropic({ apiKey: envValue('ANTHROPIC_API_KEY') });
}

/** Reviews one batch. Returns verdicts keyed by deal id; ids the model skipped are simply missing. */
export async function reviewBatch(client: Anthropic, batch: Candidate[]): Promise<{ reviews: Map<number, AiReview>; usage: Anthropic.Usage }> {
  // create() instead of parse(): the schema still constrains the output, but we validate leniently ourselves.
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(batch) }],
    output_config: { effort: 'low', format: zodOutputFormat(Reviews) },
  });
  if (response.stop_reason === 'refusal') throw new Error(`AI odmówiło oceny paczki (${response.stop_details?.category ?? 'brak kategorii'})`);
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const ids = new Set(batch.map((c) => c.id));
  const reviews = new Map(parseReviews(text).filter((r) => ids.has(r.id)).map((r) => [r.id, r]));
  return { reviews, usage: response.usage };
}

/** Deals that crossed the AI threshold and were not reviewed at their current price yet. */
export async function loadCandidates(db: Db, settings: Settings): Promise<Candidate[]> {
  const [{ used }] = await db
    .select({ used: sql<number>`count(*)::int` })
    .from(deals)
    .where(gte(deals.aiAt, new Date(Date.now() - 86_400_000)));
  const budget = Math.max(0, settings.aiDailyLimit - used);
  if (!budget) return [];

  return db
    .select({
      id: deals.id,
      title: products.title,
      shop: shops.name,
      price: deals.price,
      referencePrice: deals.referencePrice,
      realDiscountPct: deals.realDiscountPct,
      temperature: deals.temperature,
      flags: deals.flags,
      category: products.category,
      inStock: deals.inStock,
    })
    .from(deals)
    .innerJoin(products, eq(deals.productId, products.id))
    .innerJoin(shops, eq(products.shopId, shops.id))
    .where(and(
      inArray(deals.status, ['new', 'starred']),
      gte(deals.score, settings.aiThreshold),
      or(isNull(deals.aiPrice), ne(deals.aiPrice, deals.price)),
    ))
    .orderBy(desc(deals.score))
    .limit(budget);
}

export async function runAiReviews(db: Db, settings: Settings, log: (msg: string) => void = console.log) {
  const candidates = await loadCandidates(db, settings);
  if (!candidates.length) return log('AI: brak nowych kandydatów (albo wyczerpany dzienny limit).');

  const client = createAiClient();
  let input = 0;
  let output = 0;
  for (let i = 0; i < candidates.length; i += settings.aiBatchSize) {
    const batch = candidates.slice(i, i + settings.aiBatchSize);
    try {
      const { reviews, usage } = await reviewBatch(client, batch);
      input += usage.input_tokens;
      output += usage.output_tokens;
      const now = new Date();
      for (const c of batch) {
        const r = reviews.get(c.id);
        if (!r) continue;
        await db
          .update(deals)
          .set({ aiVerdict: r.verdict, aiCategory: r.category, aiSummary: r.summary, aiReason: r.reason, aiPrice: c.price, aiAt: now })
          .where(eq(deals.id, c.id));
      }
    } catch (err) {
      // Scraping results are already saved; AI is best-effort and retries on the next run.
      if (err instanceof Anthropic.RateLimitError) log('AI: limit zapytań, kończę na ten przebieg.');
      else if (err instanceof Anthropic.AuthenticationError) log('AI: nieprawidłowy ANTHROPIC_API_KEY.');
      else log(`AI: błąd paczki: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }
  log(`AI: oceniono do ${candidates.length} deali, tokeny in/out: ${input}/${output}.`);
}
