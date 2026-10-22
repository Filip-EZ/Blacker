/** A single offer as seen by an adapter, before it touches the database. */
export interface RawOffer {
  /** Canonical URL; together with shopDomain it identifies the product. */
  url: string;
  shopName: string;
  shopDomain: string;
  title: string;
  price: number;
  currency: string;
  /** Strikethrough / "catalog" price shown by the shop. Not trusted on its own. */
  regularPrice?: number;
  /** "Najniższa cena z 30 dni" required by the Omnibus directive. */
  omnibusLow30d?: number;
  inStock?: boolean;
  image?: string;
  gtin?: string;
  category?: string;
  /** Pepper.pl temperature (community votes), when the offer comes from Pepper. */
  temperature?: number;
  /** Flash promos (e.g. x-kom Gorący strzał) end at a known time. */
  endsAt?: Date;
}

export interface SourceConfig {
  id: string;
  name: string;
  adapter: string;
  /** Big shops vs small shops, used for dashboard filters. */
  tier: 'aggregator' | 'big' | 'small';
  enabled: boolean;
  url?: string;
  urls?: string[];
  category?: string;
  /** Max items per run for catalog-style adapters (Shopify, Woo). */
  limit?: number;
}

export interface Http {
  text(url: string, init?: { accept?: string }): Promise<string>;
  json<T = unknown>(url: string): Promise<T>;
}

export interface SourceAdapter {
  fetch(source: SourceConfig, http: Http): Promise<RawOffer[]>;
}
