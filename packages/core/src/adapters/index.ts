import type { SourceAdapter } from '../types';
import { empik } from './empik';
import { jsonld } from './jsonld';
import { komputronik } from './komputronik';
import { moreleDaily } from './morele';
import { pepper } from './pepper';
import { shopify } from './shopify';
import { woocommerce } from './woocommerce';
import { xkomHotShot } from './xkom';

/** Adapter name (as used in config/sources.yaml) -> implementation. */
export const adapters: Record<string, SourceAdapter> = {
  pepper,
  'xkom-hotshot': xkomHotShot,
  'morele-daily': moreleDaily,
  komputronik,
  empik,
  jsonld,
  shopify,
  woocommerce,
};
