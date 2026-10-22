import { describe, expect, it } from 'vitest';
import { normalizeCategory, parseReviews } from '../src/ai';

describe('normalizeCategory', () => {
  it('dopasowuje kategorię mimo innej wielkości liter i spacji', () => {
    expect(normalizeCategory(' dom i Ogród ')).toBe('Dom i ogród');
  });
  it('nieznaną kategorię zamienia na "Inne"', () => {
    expect(normalizeCategory('Książki')).toBe('Inne');
    expect(normalizeCategory(undefined)).toBe('Inne');
  });
});

describe('parseReviews', () => {
  const ok = { id: 1, verdict: 'super', category: 'AGD', summary: 's', reason: 'r' };

  it('jeden błędny wpis nie odrzuca reszty paczki', () => {
    const text = JSON.stringify({ reviews: [ok, { ...ok, id: 2, category: 'Książki' }, { ...ok, id: 3, verdict: 'świetne' }] });
    const reviews = parseReviews(text);
    expect(reviews.map((r) => r.id)).toEqual([1, 2]);
    expect(reviews[1].category).toBe('Inne');
  });
  it('zwraca pustą listę dla niepoprawnego JSON-a', () => {
    expect(parseReviews('nie json')).toEqual([]);
  });
});

describe('envValue', () => {
  it('obcina cudzysłowy i spacje wokół wartości', async () => {
    const { envValue } = await import('../src/env');
    process.env.BLACKER_TEST = '  "postgresql://u:p@host/db?sslmode=require"\n';
    expect(envValue('BLACKER_TEST')).toBe('postgresql://u:p@host/db?sslmode=require');
    process.env.BLACKER_TEST = "''";
    expect(envValue('BLACKER_TEST')).toBeUndefined();
    delete process.env.BLACKER_TEST;
  });
});
