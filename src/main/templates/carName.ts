import type { CarClass } from '../../shared/types';

const CLASS_TOKENS: Record<string, CarClass> = {
  HYPER: 'Hypercar',
  LMP2: 'LMP2',
  LMP3: 'LMP3',
  GT3: 'GT3',
  GTE: 'GTE',
};
const VARIANT = /^(\d{4}|ELMS|EVO)$/i;
const OVERRIDES: Array<[string, string]> = [
  ['BMWM4', 'BMW M4'],
  ['BMWM Hybrid', 'BMW M Hybrid'],
  ['Mc Laren', 'McLaren'],
];

const isUpper = (c: string | undefined): boolean => !!c && c >= 'A' && c <= 'Z';
const isLower = (c: string | undefined): boolean => !!c && c >= 'a' && c <= 'z';
const isDigit = (c: string | undefined): boolean => !!c && c >= '0' && c <= '9';
const isLetter = (c: string | undefined): boolean => isUpper(c) || isLower(c);

/** Splits a camel-case model token ("Ferrari296LMGT3") into words ("Ferrari 296 LMGT3"). */
function splitWords(token: string): string {
  let out = token[0] ?? '';
  for (let i = 1; i < token.length; i++) {
    const prev = token[i - 1];
    const cur = token[i];
    const next = token[i + 1];
    let split = false;
    if (isLower(prev) && isUpper(cur)) split = true;
    else if (isUpper(prev) && isUpper(cur) && isLower(next)) split = true;
    else if (isLetter(prev) && isDigit(cur)) {
      // the letters of the current word only (since the last split), e.g. "Z" in "Corvette Z06"
      const word = out.slice(out.lastIndexOf(' ') + 1);
      const run = /[A-Za-z]+$/.exec(word)?.[0] ?? '';
      split = run.length >= 2 && /[a-z]/.test(run);
    } else if (isDigit(prev) && isUpper(cur) && (isUpper(next) || isLower(next))) split = true;
    out += (split ? ' ' : '') + cur;
  }
  return out;
}

/** Turns "Template_GT3_Ferrari296LMGT3_2025_ELMS.psd" into { GT3, "Ferrari 296 LMGT3 — 2025 ELMS" }. */
export function carDisplayName(fileName: string): { carClass: CarClass; label: string } {
  const base = fileName.replace(/\.psd$/i, '').replace(/^Template_/i, '');
  const tokens = base.split('_').map((t) => t.trim()).filter(Boolean);
  const carClass = CLASS_TOKENS[(tokens[0] ?? '').toUpperCase()] ?? 'Other';
  const rest = tokens.slice(1);
  const variants = rest.filter((t) => VARIANT.test(t));
  let model = rest.filter((t) => !VARIANT.test(t)).map(splitWords).join(' ');
  for (const [from, to] of OVERRIDES) model = model.replace(from, to);
  if (!model) model = base;
  return { carClass, label: variants.length ? `${model} — ${variants.join(' ')}` : model };
}
