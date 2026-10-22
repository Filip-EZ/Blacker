import { fromMinorUnits } from '../price';
import type { RawOffer, SourceAdapter } from '../types';

interface WooProduct {
  name: string;
  permalink: string;
  is_in_stock?: boolean;
  images?: { src: string }[];
  categories?: { name: string }[];
  prices: { price: string; regular_price?: string; currency_code?: string; currency_minor_unit?: number };
}

/** WooCommerce Store API (/wp-json/wc/store/v1/products), public on most Woo shops. */
export function parseWooProducts(data: WooProduct[], shopName: string): RawOffer[] {
  return data.flatMap((p) => {
    const unit = p.prices.currency_minor_unit ?? 2;
    const price = fromMinorUnits(p.prices.price, unit);
    if (price == null) return [];
    const regular = fromMinorUnits(p.prices.regular_price, unit);
    return [{
      url: p.permalink,
      shopName,
      shopDomain: new URL(p.permalink).hostname.replace(/^www\./, ''),
      title: decodeEntities(p.name),
      price,
      currency: p.prices.currency_code ?? 'PLN',
      regularPrice: regular && regular > price ? regular : undefined,
      inStock: p.is_in_stock,
      image: p.images?.[0]?.src,
      category: p.categories?.[0]?.name,
    }];
  });
}

function decodeEntities(s: string): string {
  return s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

export const woocommerce: SourceAdapter = {
  async fetch(source, http) {
    const origin = new URL(source.url!).origin;
    const perPage = Math.min(source.limit ?? 100, 100);
    // on_sale=true keeps the payload to products the shop itself marks as discounted.
    const data = await http.json<WooProduct[]>(`${origin}/wp-json/wc/store/v1/products?on_sale=true&per_page=${perPage}`);
    return parseWooProducts(data, source.name).map((o) => ({ ...o, category: source.category ?? o.category }));
  },
};
