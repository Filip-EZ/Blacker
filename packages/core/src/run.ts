import { runAiReviews } from './ai';
import { adapters } from './adapters';
import type { Settings } from './config';
import type { Db } from './db';
import { errorMessage } from './errors';
import { BlockedError, createHttp } from './http';
import { scoreOffer, type Score } from './scoring';
import { expireStale, pruneRuns, recordRun, saveOffers } from './store';
import type { RawOffer, SourceConfig } from './types';

export interface RunOptions {
  settings: Settings;
  sources: SourceConfig[];
  /** null = dry run: fetch and score without touching the database. */
  db: Db | null;
  ai: boolean;
  log?: (msg: string) => void;
}

export interface DryResult {
  offer: RawOffer;
  score: Score;
}

export async function run({ settings, sources, db, ai, log = console.log }: RunOptions): Promise<DryResult[]> {
  const http = createHttp({ delayMs: settings.requestDelayMs });
  const dry: DryResult[] = [];

  // Sources hit different hosts, so they run in parallel; the per-host rate limit lives in http.
  await Promise.all(sources.map(async (source) => {
    const started = Date.now();
    try {
      const offers = await adapters[source.adapter].fetch(source, http);
      if (db) {
        const stats = await saveOffers(db, source, offers, settings);
        log(`✓ ${source.id}: ${stats.offers} ofert, ${stats.snapshots} nowych cen, ${stats.deals} deali`);
      } else {
        // No DB means no history: scores reflect Omnibus, strikethrough prices and Pepper only.
        dry.push(...offers.map((offer) => ({ offer, score: scoreOffer(offer) })));
        log(`✓ ${source.id}: ${offers.length} ofert`);
      }
      if (db) await recordRun(db, { sourceId: source.id, ok: true, offers: offers.length, durationMs: Date.now() - started });
    } catch (err) {
      const message = errorMessage(err);
      log(`${err instanceof BlockedError ? '⊘' : '✗'} ${source.id}: ${message}`);
      if (db) await recordRun(db, { sourceId: source.id, ok: false, error: message.slice(0, 500), durationMs: Date.now() - started });
    }
  }));

  if (db) {
    await expireStale(db);
    await pruneRuns(db);
    if (ai) await runAiReviews(db, settings, log);
  }
  return dry.sort((a, b) => b.score.score - a.score.score);
}
