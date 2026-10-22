import { parsePrice } from './price';

// "Najniższa cena z ostatnich 30 dni: 169,00 zł", "Najniższa cena z 30 dni przed obniżką: 1 299 zł".
// Requires "30 dni" so unrelated "Najniższa cena:" labels (recommendation widgets) do not match.
const OMNIBUS_RE =
  /najni[żz]sza\s+cena\s+(?:produktu\s+)?z\s+(?:ostatnich\s+)?30\s+dni(?:\s+przed\s+obni[żz]k[aą])?\s*:?\s*([\d][\d\s., ]*)\s*(?:zł|pln)/i;

/** Extracts the Omnibus 30-day lowest price from a product page's HTML. */
export function extractOmnibus(html: string): number | undefined {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const m = text.match(OMNIBUS_RE);
  return m ? parsePrice(m[1]) : undefined;
}
