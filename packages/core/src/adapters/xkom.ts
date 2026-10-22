import type { RawOffer, SourceAdapter } from '../types';
import { extractAssignedJson } from './embedded-json';

interface XkomHotShot {
  id: string;
  extend: {
    promotionName: string;
    promotionTotalCount: number;
    saleCount: number;
    promotionEnd: string;
    isActive: boolean;
    isSuspended: boolean;
    promotionPhoto?: { url?: string };
  };
  productContextData: {
    price: number;
    oldPrice?: number | null;
    minPriceInfo?: { minPrice?: number | null };
  };
}

/**
 * x-kom / al.to "Gorący strzał": data sits in window.__INITIAL_STATE__['app'].productsLists.hotShot.
 * minPriceInfo.minPrice is the Omnibus 30-day low. Product JSON-LD shows the regular price,
 * not the hot shot price, so the generic JSON-LD adapter would miss these.
 */
export function parseXkomHotShot(html: string, origin: string, shopName: string): RawOffer[] {
  const state = extractAssignedJson<{ productsLists?: { hotShot?: XkomHotShot[] } }>(
    html,
    "window.__INITIAL_STATE__['app'] =",
  );
  const list = state?.productsLists?.hotShot ?? [];

  return list
    .filter((hs) => hs.extend?.isActive && !hs.extend.isSuspended && hs.productContextData?.price != null)
    .map((hs) => ({
      url: `${origin}/p/${hs.id}`,
      shopName,
      shopDomain: new URL(origin).hostname.replace(/^www\./, ''),
      title: hs.extend.promotionName,
      price: hs.productContextData.price,
      currency: 'PLN',
      regularPrice: hs.productContextData.oldPrice ?? undefined,
      omnibusLow30d: hs.productContextData.minPriceInfo?.minPrice ?? undefined,
      inStock: hs.extend.saleCount < hs.extend.promotionTotalCount,
      image: hs.extend.promotionPhoto?.url,
      endsAt: new Date(hs.extend.promotionEnd),
    }));
}

export const xkomHotShot: SourceAdapter = {
  async fetch(source, http) {
    const url = source.url ?? 'https://www.x-kom.pl/goracy_strzal';
    return parseXkomHotShot(await http.text(url), new URL(url).origin, source.name);
  },
};
