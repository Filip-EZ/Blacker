import { describe, expect, it } from 'vitest';
import { extractDbUrl } from '../src/db';

const URL = 'postgresql://user:npg_x@ep-a.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

describe('extractDbUrl', () => {
  it('przepuszcza sam adres', () => {
    expect(extractDbUrl(URL)).toBe(URL);
  });
  it('wyciąga adres z całej linii .env i z polecenia psql', () => {
    expect(extractDbUrl(`DATABASE_URL="${URL}"`)).toBe(URL);
    expect(extractDbUrl(`psql '${URL}'`)).toBe(URL);
  });
  it('bez adresu rzuca błąd, który pokazuje układ, ale nie wartość', () => {
    expect(() => extractDbUrl('npg_tajne')).toThrow('długość 9, "***_*****"');
    expect(() => extractDbUrl('npg_tajne')).not.toThrow(/tajne/);
  });
  it('odrzuca adres, którego nie przyjąłby neon()', () => {
    expect(() => extractDbUrl('postgresql://user:npg_x/neondb')).toThrow('"**********://****:***_*/******"');
  });
});
