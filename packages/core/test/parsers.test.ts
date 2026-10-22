import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEmpikList } from '../src/adapters/empik';
import { parseJsonLdProduct } from '../src/adapters/jsonld';
import { parseKomputronik } from '../src/adapters/komputronik';
import { parseMoreleDaily } from '../src/adapters/morele';
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

describe('duże sklepy', () => {
  it('Morele: okazja dnia z ceną z kodem, ceną bez kodu i Omnibusem', () => {
    const [offer, ...rest] = parseMoreleDaily(fixture('morele-home.html'), 'Morele');
    expect(rest).toHaveLength(0);
    expect(offer).toMatchObject({
      url: 'https://www.morele.net/lego-art-claude-monet-most-nad-stawem-z-liliami-wodnymi-31220-15924254/',
      shopDomain: 'morele.net',
      title: 'LEGO ART Claude Monet — Most nad stawem z liliami wodnymi (kod PROMO26)',
      price: 599,
      regularPrice: 658.9,
      omnibusLow30d: 609,
      inStock: true,
    });
  });

  it('Komputronik: okazja dnia i karty promocyjne, bez kart bez promocji', () => {
    const offers = parseKomputronik(fixture('komputronik-promo.html'), 'https://www.komputronik.pl', 'Komputronik');
    expect(offers[0]).toMatchObject({
      url: 'https://www.komputronik.pl/product/1021740/telefon-xiaomi-redmi-17-4-128gb-czarny.html',
      title: 'Xiaomi Redmi 17 4/128GB Czarny',
      price: 679,
      regularPrice: 789,
      omnibusLow30d: 789,
      inStock: true,
      category: 'Smartfony',
    });
    expect(offers.find((o) => o.title === 'Reolink Argus Series B350')).toMatchObject({ price: 339, regularPrice: 539, omnibusLow30d: 539 });
    expect(offers.every((o) => o.omnibusLow30d != null)).toBe(true);
    expect(new Set(offers.map((o) => o.url)).size).toBe(offers.length);
  });

  it('Empik: cena z mikrodanych, Omnibus, kategoria i sprzedawca z marketplace', () => {
    const offers = parseEmpikList(fixture('empik-okazje.html'), 'https://www.empik.com', 'Empik');
    expect(offers).toHaveLength(3);
    expect(offers[0]).toMatchObject({
      url: 'https://www.empik.com/substancja-witkowski-michal,p1756864935,ksiazka-p',
      title: 'Substancja – Witkowski Michał',
      price: 36.05,
      regularPrice: 42.99,
      omnibusLow30d: 37.95,
      category: 'Książki',
    });
    expect(offers[1].title).toContain('(sprzedawca: briXani_Sklep_Stacjonarny_Wrocław)');
    expect(offers[2]).toMatchObject({ regularPrice: undefined, omnibusLow30d: undefined });
  });
});
