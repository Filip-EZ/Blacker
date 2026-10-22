import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseJsonLdProduct } from '../src/adapters/jsonld';
import { parsePepperRss } from '../src/adapters/pepper';
import { parseShopifyProducts } from '../src/adapters/shopify';
import { parseWooProducts } from '../src/adapters/woocommerce';
import { parseXkomHotShot } from '../src/adapters/xkom';
import { parseRobots } from '../src/http';
import { extractOmnibus } from '../src/omnibus';
import { parsePrice } from '../src/price';

const fixture = (name: string) => readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8');

describe('parsePrice', () => {
  it.each([
    ['119 900zł', 119900],
    ['1 299,99 zł', 1299.99],
    ['89,00 zł', 89],
    ['1.299,00 zł', 1299],
    ['25.00', 25],
    ['1 049 zł', 1049],
    ['darmowe', undefined],
  ])('%s -> %s', (input, expected) => expect(parsePrice(input)).toBe(expected));
});

describe('extractOmnibus', () => {
  it('reads the 30-day low and ignores plain "Najniższa cena:" widgets', () => {
    expect(extractOmnibus(fixture('jsonld-product.html'))).toBe(169);
    expect(extractOmnibus('<span>Najniższa cena:<!-- --> 99,99 zł</span>')).toBeUndefined();
  });
  it('handles the "przed obniżką" wording', () => {
    expect(extractOmnibus('<p>Najniższa cena z 30 dni przed obniżką: <b>1 299,00 zł</b></p>')).toBe(1299);
  });
});

describe('Pepper RSS', () => {
  const offers = parsePepperRss(fixture('pepper-hot.xml'));
  it('parses real feed items with temperature, merchant and price', () => {
    expect(offers.length).toBeGreaterThan(20);
    const tiguan = offers.find((o) => o.title.startsWith('Volkswagen Tiguan'))!;
    expect(tiguan).toMatchObject({ temperature: 215, shopName: 'OTOMOTO', price: 119900, category: 'Motoryzacja', shopDomain: 'pepper.pl' });
    expect(tiguan.url).toMatch(/^https:\/\/www\.pepper\.pl\/promocje\//);
  });
  it('every offer has a positive price and a title without the temperature prefix', () => {
    for (const o of offers) {
      expect(o.price).toBeGreaterThan(0);
      expect(o.title).not.toMatch(/^-?\d+°/);
    }
  });
});

describe('x-kom Gorący strzał', () => {
  it('reads price, Omnibus low and sold-out state from embedded state', () => {
    const [hs] = parseXkomHotShot(fixture('xkom-hotshot.html'), 'https://www.x-kom.pl', 'x-kom');
    expect(hs).toMatchObject({
      url: 'https://www.x-kom.pl/p/1417250',
      title: 'Silver Monkey Ładowarka GaN Smart Quadro 100W PD',
      price: 89,
      regularPrice: 169,
      omnibusLow30d: 169,
      inStock: false, // 600 of 600 sold in the captured snapshot
      shopDomain: 'x-kom.pl',
    });
    expect(hs.endsAt?.toISOString()).toBe('2026-10-20T20:00:00.000Z');
  });
});

describe('JSON-LD product', () => {
  it('reads Product, offer, gtin, breadcrumb category and Omnibus', () => {
    const o = parseJsonLdProduct(fixture('jsonld-product.html'), 'https://www.x-kom.pl/p/1417250', 'x-kom')!;
    expect(o).toMatchObject({ price: 129, currency: 'PLN', omnibusLow30d: 169, inStock: true, gtin: '5903802475236', category: 'Ładowarki do smartfonów' });
  });
  it('returns undefined when there is no Product markup', () => {
    expect(parseJsonLdProduct('<html></html>', 'https://example.pl/x', 'x')).toBeUndefined();
  });
});

describe('Shopify / WooCommerce', () => {
  it('Shopify: cheapest variant and compare_at_price', () => {
    const data = JSON.parse(fixture('shopify-products.json'));
    const offers = parseShopifyProducts(data, 'https://allbirds.com', 'Allbirds', 'USD');
    expect(offers).toHaveLength(data.products.length);
    expect(offers[0]).toMatchObject({ url: 'https://allbirds.com/products/womens-allbirds-flip-flop-dusty-pink', price: 25, regularPrice: 50 });
  });
  it('Woo: minor units and no fake regular price when equal', () => {
    const offers = parseWooProducts(JSON.parse(fixture('woo-products.json')), 'Woo');
    expect(offers[0]).toMatchObject({ title: 'Restaurant Menu', price: 29, regularPrice: undefined, inStock: true });
  });
});

describe('robots.txt', () => {
  const rules = parseRobots(['User-agent: *', 'Disallow: /koszyk', 'Disallow: /*?sort=', 'Allow: /koszyk/info$'].join('\n'));
  it('applies longest match, wildcards and $', () => {
    expect(rules.allows('/goracy_strzal')).toBe(true);
    expect(rules.allows('/koszyk/1')).toBe(false);
    expect(rules.allows('/koszyk/info')).toBe(true);
    expect(rules.allows('/g/laptopy?sort=price')).toBe(false);
  });
});
