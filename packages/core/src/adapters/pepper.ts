import * as cheerio from 'cheerio';
import { parsePrice } from '../price';
import type { RawOffer, SourceAdapter } from '../types';

/**
 * Pepper.pl RSS. Each item is a community-posted deal:
 *   <title>215° - Volkswagen Tiguan ... za 119 900 zł</title>
 *   <pepper:merchant name="OTOMOTO" price="119 900zł"/>
 * The temperature (votes) is the main quality signal; the link points to the Pepper thread.
 */
export function parsePepperRss(xml: string): RawOffer[] {
  const $ = cheerio.load(xml, { xml: true });
  const offers: RawOffer[] = [];

  $('item').each((_, el) => {
    const item = $(el);
    const rawTitle = item.children('title').text().trim();
    const merchant = item.children('pepper\\:merchant');
    const price = parsePrice(merchant.attr('price'));
    const url = item.children('link').text().trim();
    // Freebies and coupons without a price are skipped: there is nothing to compare.
    if (!url || price == null) return;

    const tempMatch = rawTitle.match(/^(-?\d+)°\s*-\s*/);
    const shopName = merchant.attr('name')?.trim() || 'Pepper.pl';

    offers.push({
      url,
      shopName,
      shopDomain: 'pepper.pl',
      title: tempMatch ? rawTitle.slice(tempMatch[0].length) : rawTitle,
      price,
      currency: 'PLN',
      temperature: tempMatch ? Number(tempMatch[1]) : undefined,
      category: item.children('category').text().trim() || undefined,
      image: item.children('media\\:content').attr('url'),
    });
  });

  return offers;
}

export const pepper: SourceAdapter = {
  async fetch(source, http) {
    const urls = source.urls ?? [source.url ?? 'https://www.pepper.pl/rss/hot'];
    const all = (await Promise.all(urls.map(async (u) => parsePepperRss(await http.text(u, { accept: 'application/rss+xml,text/xml' }))))).flat();
    // The same thread can appear in several feeds (hot + nowe).
    return [...new Map(all.map((o) => [o.url, o])).values()];
  },
};
