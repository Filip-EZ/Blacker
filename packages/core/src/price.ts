/**
 * Parses Polish price strings: "119 900zł", "1 299,99 zł", "89,00 zł", "1.299,00 zł", "25.00".
 * Returns undefined when nothing numeric is found.
 */
export function parsePrice(input: string | number | null | undefined): number | undefined {
  if (input == null) return undefined;
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;

  const match = input.replace(/[  ]/g, ' ').match(/\d[\d .,]*/);
  if (!match) return undefined;
  let s = match[0].trim().replace(/ /g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(',', '.');
  } else if (lastDot > -1 && s.length - lastDot - 1 === 3 && s.indexOf('.') !== lastDot) {
    s = s.replace(/\./g, ''); // "1.299.000" thousands separators
  }

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Woo Store API returns prices in minor units ("2900" with minor_unit 2 -> 29.00). */
export function fromMinorUnits(value: string | undefined, minorUnit = 2): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n / 10 ** minorUnit : undefined;
}
