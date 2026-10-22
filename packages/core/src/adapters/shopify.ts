import { parsePrice } from '../price';
import type { RawOffer, SourceAdapter } from '../types';

interface ShopifyProduct {
  title: string;
  handle: string;
  product_type?: string;
  images?: { src: string }[];
  variants: { price: string; compare_at_price?: string | null; available?: boolean; barcode?: string | null }[];
}

/** Shopify's public /products.json. Uses the cheapest available variant. */
export function parseShopifyProducts(data: { products: ShopifyProduct[] }, origin: string, shopName: string, currency = 'PLN'): RawOffer[] {
  const shopDomain = new URL(origin).hostname.replace(/^www\./, '');
  return data.products.flatMap((p) => {
    const variants = p.variants.filter((v) => parsePrice(v.price) != null);
    if (!variants.length) return [];
    const pool = variants.some((v) => v.available) ? variants.filter((v) => v.available) : variants;
    const v = pool.reduce((a, b) => (parsePrice(b.price)! < parsePrice(a.price)! ? b : a));
    const compareAt = parsePrice(v.compare_at_price ?? undefined);
    return [{
      url: `${origin}/products/${p.handle}`,
      shopName,
      shopDomain,
      title: p.title,
      price: parsePrice(v.price)!,
      currency,
      regularPrice: compareAt && compareAt > parsePrice(v.price)! ? compareAt : undefined,
      inStock: variants.some((x) => x.available),
      image: p.images?.[0]?.src,
      gtin: v.barcode || undefined,
      category: p.product_type || undefined,
    }];
  });
}

export const shopify: SourceAdapter = {
  async fetch(source, http) {
    const origin = new URL(source.url!).origin;
    const limit = Math.min(source.limit ?? 250, 250);
    const data = await http.json<{ products: ShopifyProduct[] }>(`${origin}/products.json?limit=${limit}`);
    return parseShopifyProducts(data, origin, source.name).map((o) => ({ ...o, category: source.category ?? o.category }));
  },
};
