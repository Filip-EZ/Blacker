import type { SourceAdapter } from '../types';
import { jsonld } from './jsonld';
import { pepper } from './pepper';
import { shopify } from './shopify';
import { woocommerce } from './woocommerce';
import { xkomHotShot } from './xkom';

/** Adapter name (as used in config/sources.yaml) -> implementation. */
export const adapters: Record<string, SourceAdapter> = {
  pepper,
  'xkom-hotshot': xkomHotShot,
  jsonld,
  shopify,
  woocommerce,
};
