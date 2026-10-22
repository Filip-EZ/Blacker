import * as cheerio from 'cheerio';
import { extractOmnibus } from '../omnibus';
import { parsePrice } from '../price';
import type { RawOffer, SourceAdapter } from '../types';

const REGULAR_RE = /Cena bez promocji:\s*([\d\s., ]+)\s*zł/i;

/**
 * Komputronik (Nuxt, server-rendered). Two shapes, both marked with data-name attributes:
 * - the home page "okazja dnia" widget (DailyDealWidget*),
 * - product cards on listings such as /promocje/hity-miesiaca; only cards with a promo price block
 *   (base price + Omnibus 30-day low) are kept.
 * The /promotions page itself is 403 for bots.
 */
export function parseKomputronik(html: string, origin: string, shopName: string): RawOffer[] {
  const $ = cheerio.load(html);
  const shopDomain = new URL(origin).hostname.replace(/^www\./, '');
  const offers = new Map<string, RawOffer>();
  const add = (o: RawOffer) => offers.has(o.url) || offers.set(o.url, o);

  $('[data-name="DailyDealWidgetName"]').each((_, el) => {
    const link = $(el).closest('a');
    const box = link.parent();
    const href = link.attr('href');
    const price = parsePrice(box.find('[data-name="DailyDealWidgetFinalPrice"]').text());
    if (!href || price == null) return;
    const text = box.text().replace(/\s+/g, ' ');
    const left = text.match(/Pozostało:\s*(\d+)/)?.[1];
    add({
      url: new URL(href, origin).href,
      shopName,
      shopDomain,
      title: $(el).text().trim(),
      price,
      currency: 'PLN',
      regularPrice: parsePrice(text.match(REGULAR_RE)?.[1]),
      omnibusLow30d: extractOmnibus(text),
      inStock: left != null ? Number(left) > 0 : undefined,
      image: link.find('img').attr('src'),
      category: link.find('p').first().text().trim() || undefined,
    });
  });

  $('[data-name="cardProduct"]').each((_, el) => {
    const card = $(el);
    const promo = card.find('[data-name="productCardPricePromo"]');
    const link = card.find('a[href*="/product/"]').first();
    const href = link.attr('href');
    const price = parsePrice(card.find('[data-name="productPrice"] > p').first().text());
    if (!promo.length || !href || price == null) return;
    add({
      url: new URL(href, origin).href,
      shopName,
      shopDomain,
      title: link.attr('title')?.trim() ?? '',
      price,
      currency: 'PLN',
      regularPrice: parsePrice(promo.find('[price-type="base"] span').first().text()),
      omnibusLow30d: parsePrice(promo.find('[price-type="omnibus"] span').first().text()),
      image: link.find('img').attr('src'),
      category: link.find('p').first().text().trim() || undefined,
    });
  });

  return [...offers.values()].filter((o) => o.title);
}

export const komputronik: SourceAdapter = {
  async fetch(source, http) {
    const offers: RawOffer[] = [];
    for (const url of source.urls ?? [source.url ?? 'https://www.komputronik.pl/']) {
      offers.push(...parseKomputronik(await http.text(url), new URL(url).origin, source.name));
    }
    // The daily deal often repeats on listings; keep the first (richest) copy.
    return [...new Map(offers.map((o) => [o.url, o])).values()];
  },
};
