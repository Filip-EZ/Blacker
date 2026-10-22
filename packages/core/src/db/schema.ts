import { boolean, doublePrecision, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const shops = pgTable('shops', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  domain: text().notNull(),
});

export const products = pgTable('products', {
  id: serial().primaryKey(),
  shopId: integer().notNull().references(() => shops.id),
  /** config/sources.yaml id the product was last seen through. */
  sourceId: text().notNull(),
  tier: text().$type<'aggregator' | 'big' | 'small'>().notNull(),
  url: text().notNull().unique(),
  title: text().notNull(),
  category: text(),
  gtin: text(),
  image: text(),
  firstSeen: createdAt(),
  lastSeen: createdAt(),
});

export const priceSnapshots = pgTable(
  'price_snapshots',
  {
    id: serial().primaryKey(),
    productId: integer().notNull().references(() => products.id),
    price: doublePrecision().notNull(),
    regularPrice: doublePrecision(),
    omnibusLow30d: doublePrecision(),
    inStock: boolean(),
    temperature: integer(),
    fetchedAt: createdAt(),
  },
  (t) => [index('snapshots_product_time').on(t.productId, t.fetchedAt)],
);

export type DealStatus = 'new' | 'starred' | 'hidden' | 'expired';
export type AiVerdict = 'super' | 'ok' | 'słabe' | 'podejrzane';

/** One row per product: the current deal for it, updated as the price moves. */
export const deals = pgTable(
  'deals',
  {
    id: serial().primaryKey(),
    productId: integer().notNull().unique().references(() => products.id),
    price: doublePrecision().notNull(),
    referencePrice: doublePrecision(),
    realDiscountPct: doublePrecision(),
    score: integer().notNull(),
    flags: text().array().notNull().default([]),
    temperature: integer(),
    inStock: boolean(),
    endsAt: timestamp({ withTimezone: true }),
    status: text().$type<DealStatus>().notNull().default('new'),
    /** When the current price was first seen as a deal; reset on price change. */
    detectedAt: createdAt(),
    updatedAt: createdAt(),
    aiVerdict: text().$type<AiVerdict>(),
    aiSummary: text(),
    aiCategory: text(),
    aiReason: text(),
    /** Price the AI verdict refers to; a new price means a new review. */
    aiPrice: doublePrecision(),
    aiAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('deals_score').on(t.status, t.score)],
);

/** Adapter health: one row per source per run. */
export const sourceRuns = pgTable('source_runs', {
  id: serial().primaryKey(),
  sourceId: text().notNull(),
  ok: boolean().notNull(),
  offers: integer().notNull().default(0),
  error: text(),
  startedAt: createdAt(),
  durationMs: integer(),
});
