import * as cheerio from 'cheerio';
import { parsePrice } from '../price';
import type { RawOffer, SourceAdapter } from '../types';

/**
 * Empik listings (/okazje/produkty, /black-friday): server-rendered `.ta-product-tile` boxes with
 * schema.org microdata for the price and explicit Omnibus fields ("najniższa cena", "cena regularna").
 * Marketplace items from other sellers are kept, with the seller named in the title.
 */
export function parseEmpikList(html: string, origin: string, shopName: string): RawOffer[] {
  const $ = cheerio.load(html);
  const offers: RawOffer[] = [];

  $('.ta-product-tile').each((_, el) => {
    const tile = $(el);
    const href = tile.find('a.seoTitle').attr('href') ?? tile.find('a.boxLink').attr('href');
    const price = parsePrice(tile.find('[itemprop="price"]').attr('content'));
    const name = tile.find('.ta-product-title').text().trim();
    if (!href || price == null || !name) return;

    const author = tile.find('.smartAuthor').first().text().replace(/\s+/g, ' ').trim();
    const merchant = tile.attr('data-merchant-name');
    const availability = tile.find('[data-availabilitytype]').attr('data-availabilitytype');

    offers.push({
      url: new URL(href, origin).href,
      shopName,
      shopDomain: new URL(origin).hostname.replace(/^www\./, ''),
      title: [name, author && `– ${author}`, merchant && merchant !== 'Empik' && `(sprzedawca: ${merchant})`]
        .filter(Boolean)
        .join(' '),
      price,
      currency: tile.find('[itemprop="priceCurrency"]').attr('content') ?? 'PLN',
      regularPrice: parsePrice(tile.find('[data-ta="omnibus-price-type"] .strike').text()),
      omnibusLow30d: parsePrice(tile.find('[data-ta="omnibus-minimum-price"] .strike').text()),
      inStock: availability ? !/UNAVAILABLE|NOT_AVAILABLE/i.test(availability) : undefined,
      image: tile.find('meta[itemprop="image"]').attr('content'),
      category: tile.attr('data-product-category')?.split('/')[0] || undefined,
    });
  });
  return offers;
}

export const empik: SourceAdapter = {
  async fetch(source, http) {
    const offers: RawOffer[] = [];
    for (const url of source.urls ?? [source.url ?? 'https://www.empik.com/okazje/produkty']) {
      offers.push(...parseEmpikList(await http.text(url), new URL(url).origin, source.name));
    }
    return [...new Map(offers.map((o) => [o.url, o])).values()];
  },
};
