import * as cheerio from 'cheerio';
import { extractOmnibus } from '../omnibus';
import { parsePrice } from '../price';
import type { RawOffer, SourceAdapter } from '../types';

/**
 * Morele "Okazja dnia": a `.promotion-box` on the home page. The promo price often needs a code
 * ("Cena z kodem: PROMO26"); the code goes into the title so it is visible on the dashboard.
 * The /promocje and lp.morele.net pages are 404/403 for bots, so the home page is the only source.
 */
export function parseMoreleDaily(html: string, shopName: string): RawOffer[] {
  const $ = cheerio.load(html);
  const offers: RawOffer[] = [];

  $('.promotion-box').each((_, el) => {
    const box = $(el);
    const link = box.find('.promo-box-name a').first();
    const url = link.attr('href');
    // The price sits next to its label; drop the label to read the number alone.
    const price = parsePrice(box.find('.promo-box-new-price').clone().children().remove().end().text());
    if (!url || price == null) return;

    const code = box.find('.promo-box-new-price--label').text().match(/kodem:\s*(\S+)/i)?.[1];
    const left = box.find('.status-box-was').text().match(/(\d+)/)?.[1];
    const title = link.attr('title')?.trim() || link.text().trim();

    offers.push({
      url,
      shopName,
      shopDomain: new URL(url).hostname.replace(/^www\./, ''),
      title: code ? `${title} (kod ${code})` : title,
      price,
      currency: 'PLN',
      regularPrice: parsePrice(box.find('.promo-box-old-price').clone().children().remove().end().text()),
      omnibusLow30d: extractOmnibus($.html(box.find('.promo-box-info'))),
      inStock: left != null ? Number(left) > 0 : undefined,
      image: box.find('.prom-box-image img').attr('src'),
    });
  });
  return offers;
}

export const moreleDaily: SourceAdapter = {
  async fetch(source, http) {
    return parseMoreleDaily(await http.text(source.url ?? 'https://www.morele.net/'), source.name);
  },
};
