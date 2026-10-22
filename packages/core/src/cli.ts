import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { createAiClient, reviewBatch } from './ai';
import { loadConfig } from './config';
import { createDb } from './db';
import { run } from './run';

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
loadEnv({ path: root('.env'), quiet: true });

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-ai': { type: 'boolean', default: false },
    'ai-dry': { type: 'boolean', default: false },
    top: { type: 'string', default: '15' },
    config: { type: 'string', default: root('config/sources.yaml') },
  },
});

const { settings, sources: all } = loadConfig(values.config);
const wanted = values.source?.split(',');
const sources = all.filter((s) => (wanted ? wanted.includes(s.id) : s.enabled));
if (wanted) {
  const unknown = wanted.filter((w) => !all.some((s) => s.id === w));
  if (unknown.length) throw new Error(`Nieznane źródła: ${unknown.join(', ')}`);
}

const dryRun = values['dry-run'] || values['ai-dry'];
const results = await run({ settings, sources, db: dryRun ? null : createDb(), ai: !values['no-ai'] });

if (dryRun) {
  const top = results.slice(0, Number(values.top));
  console.table(top.map(({ offer, score }) => ({
    wynik: score.score,
    rabat: score.realDiscountPct != null ? `${score.realDiscountPct}%` : '',
    cena: offer.price,
    'ref.': score.referencePrice ?? '',
    '°': offer.temperature ?? '',
    sklep: offer.shopName.slice(0, 14),
    tytuł: offer.title.slice(0, 50),
    flagi: score.flags.join(','),
  })));

  if (values['ai-dry']) {
    const sample = top.slice(0, 3).map(({ offer, score }, id) => ({
      id,
      title: offer.title,
      shop: offer.shopName,
      price: offer.price,
      referencePrice: score.referencePrice ?? null,
      realDiscountPct: score.realDiscountPct ?? null,
      temperature: offer.temperature ?? null,
      flags: score.flags,
      category: offer.category ?? null,
      inStock: offer.inStock ?? null,
    }));
    const { reviews, usage } = await reviewBatch(createAiClient(), sample);
    for (const c of sample) console.log(`\n[${c.id}] ${c.title}\n   →`, reviews.get(c.id) ?? '(brak oceny)');
    console.log(`\nTokeny in/out: ${usage.input_tokens}/${usage.output_tokens}`);
  }
}
