import * as cheerio from 'cheerio';
import { extractOmnibus } from '../omnibus';
import { parsePrice } from '../price';
import type { RawOffer, SourceAdapter } from '../types';

type Json = Record<string, any>;

/** Flattens JSON-LD blocks, including @graph containers and arrays. */
function* walk(node: unknown): Generator<Json> {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (node && typeof node === 'object') {
    const obj = node as Json;
    yield obj;
    if (obj['@graph']) yield* walk(obj['@graph']);
  }
}

const isType = (n: Json, t: string) => [n['@type']].flat().includes(t);

/**
 * Generic adapter for product pages carrying schema.org Product markup.
 * Works for most small shops (Shoper, IdoSell, PrestaShop, WooCommerce themes, ...).
 */
export function parseJsonLdProduct(html: string, pageUrl: string, shopName: string): RawOffer | undefined {
  const $ = cheerio.load(html);
  const nodes: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      nodes.push(...walk(JSON.parse($(el).text())));
    } catch {
      // Broken JSON-LD is common; skip that block.
    }
  });

  const product = nodes.find((n) => isType(n, 'Product'));
  if (!product) return undefined;

  const offers = [product.offers].flat().filter(Boolean) as Json[];
  // AggregateOffer carries lowPrice; plain Offer carries price.
  const offer = offers.find((o) => o.price != null || o.lowPrice != null);
  const price = parsePrice(offer?.price ?? offer?.lowPrice);
  if (price == null) return undefined;

  const breadcrumb = nodes.find((n) => isType(n, 'BreadcrumbList'));
  const crumbs = (breadcrumb?.itemListElement ?? []) as Json[];
  const image = [product.image].flat()[0];

  return {
    url: product.url ?? offer?.url ?? pageUrl,
    shopName,
    shopDomain: new URL(pageUrl).hostname.replace(/^www\./, ''),
    title: String(product.name ?? $('title').text()).trim(),
    price,
    currency: offer?.priceCurrency ?? 'PLN',
    omnibusLow30d: extractOmnibus(html),
    inStock: offer?.availability ? /InStock|LimitedAvailability|PreOrder/i.test(offer.availability) : undefined,
    image: typeof image === 'string' ? image : image?.url,
    gtin: product.gtin13 ?? product.gtin ?? product.gtin8 ?? product.ean ?? undefined,
    category: crumbs.length ? String(crumbs[crumbs.length - 1].name ?? crumbs[crumbs.length - 1].item?.name) : undefined,
  };
}

export const jsonld: SourceAdapter = {
  async fetch(source, http) {
    const offers: RawOffer[] = [];
    for (const url of source.urls ?? []) {
      const offer = parseJsonLdProduct(await http.text(url), url, source.name);
      if (offer) offers.push({ ...offer, category: source.category ?? offer.category });
    }
    return offers;
  },
};
