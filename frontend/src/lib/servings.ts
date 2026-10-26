import type { Ingredient } from '../types';
import type { Language } from './i18n';

// Scales ingredient amounts to another serving size for display. The stored recipe is never changed.

const MAX_SELECTABLE_SERVINGS = 12;

/** Serving sizes a reader can pick: 1–12, plus the recipe's own yield when that is larger. */
export const servingOptions = (original: number): number[] => {
  const options = Array.from({ length: MAX_SELECTABLE_SERVINGS }, (_, i) => i + 1);
  return original > MAX_SELECTABLE_SERVINGS ? [...options, original] : options;
};

const UNICODE_FRACTIONS = new Map([
  ['½', 1 / 2], ['⅓', 1 / 3], ['⅔', 2 / 3], ['¼', 1 / 4], ['¾', 3 / 4], ['⅕', 1 / 5], ['⅖', 2 / 5], ['⅗', 3 / 5],
  ['⅘', 4 / 5], ['⅙', 1 / 6], ['⅚', 5 / 6], ['⅛', 1 / 8], ['⅜', 3 / 8], ['⅝', 5 / 8], ['⅞', 7 / 8],
]);
const UNICODE_AMOUNT = new RegExp(`^(\\d*) ?([${[...UNICODE_FRACTIONS.keys()].join('')}])$`);

/** Reads "2", "2.5", "2,5", ".5", "1/2", "1 1/2", "½" or "1½"; anything else is null. */
const parseAmount = (text: string): number | null => {
  const decimal = /^(\d+)?(?:([.,])(\d+))?$/.exec(text);
  if (decimal && /\d/.test(text)) {
    const [, whole = '0', separator, fraction = '0'] = decimal;
    // "1,000" may be a thousands separator or a decimal comma, so don't guess.
    if (separator === ',' && fraction.length === 3) return null;
    return Number(`${whole}.${fraction}`);
  }
  const vulgar = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(text);
  if (vulgar) {
    const [, whole = '0', numerator, denominator] = vulgar;
    return Number(denominator) === 0 ? null : Number(whole) + Number(numerator) / Number(denominator);
  }
  const unicode = UNICODE_AMOUNT.exec(text);
  if (unicode) return Number(unicode[1] || 0) + (UNICODE_FRACTIONS.get(unicode[2]) ?? Number.NaN);
  return null;
};

interface ParsedQuantity {
  /** One amount, or the low and high end of a range. */
  amounts: number[];
  /** What joined a range ("-", " to ", …), reused when it is displayed. */
  separator: string;
  decimalComma: boolean;
}

// "2-3", "2 to 3" or the Dutch "2 tot 3".
const RANGE = /^(.+?)( ?[-–—] ?| to | tot )(.+)$/i;

const parseQuantity = (quantity: string): ParsedQuantity | null => {
  const text = quantity.trim().replace(/\s+/g, ' ').replaceAll('⁄', '/');
  const range = RANGE.exec(text);
  const amounts = (range ? [range[1], range[3]] : [text]).map(parseAmount);
  if (!amounts.every((amount): amount is number => amount !== null && amount > 0)) return null;
  // Rejects "1-1/2", which is a mixed number in some recipes and a backwards range in others.
  if (range && amounts[0] >= amounts[1]) return null;
  return { amounts, separator: range?.[2] ?? '', decimalComma: /\d,\d/.test(text) };
};

// Metric weights, volumes and lengths read best as decimals ("37.5 g"); everything else as fractions ("1½ cups").
const METRIC_UNITS = new Set([
  'mg', 'g', 'gr', 'gram', 'grams', 'kg', 'kilo', 'kilos', 'kilogram', 'kilograms',
  'ml', 'cl', 'dl', 'l', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'liter', 'liters', 'litre', 'litres',
  'mm', 'cm',
]);
const isMetric = (unit: string) => METRIC_UNITS.has(unit.toLowerCase().split(' ')[0].replace(/\.$/, ''));

const KITCHEN_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
];
const FRACTION_TOLERANCE = 0.02;

interface FormattedAmount {
  text: string;
  /** The value as displayed, after rounding. */
  value: number;
}

const formatDecimal = (value: number, decimalComma: boolean): FormattedAmount => {
  let digits = 2;
  if (value >= 100) digits = 0;
  else if (value >= 10) digits = 1;
  let rounded = Number(value.toFixed(digits));
  if (rounded === 0) rounded = Number(value.toPrecision(1));
  const text = String(rounded);
  return { text: decimalComma ? text.replace('.', ',') : text, value: rounded };
};

/** "1½", "⅓", "3" — or null when the value isn't close to a fraction you could measure. */
const formatFraction = (value: number): FormattedAmount | null => {
  const whole = Math.floor(value);
  const rest = value - whole;
  if (rest < FRACTION_TOLERANCE) return whole > 0 ? { text: String(whole), value: whole } : null;
  if (rest > 1 - FRACTION_TOLERANCE) return { text: String(whole + 1), value: whole + 1 };
  const match = KITCHEN_FRACTIONS.find(([fraction]) => Math.abs(rest - fraction) < FRACTION_TOLERANCE);
  return match ? { text: `${whole || ''}${match[1]}`, value: whole + match[0] } : null;
};

const formatAmount = (value: number, metric: boolean, decimalComma: boolean): FormattedAmount => {
  const fraction = metric || value >= 100 ? null : formatFraction(value);
  return fraction ?? formatDecimal(value, decimalComma);
};

// Unit words that change with the amount ("1 cup", "2 cups"), per language of the recipe text.
// Abbreviations such as tbsp, el or g stay as they are, and so do Dutch metric words ("200 gram", "2 liter").
const UNIT_FORMS: Record<Language, [singular: string, plural: string][]> = {
  en: [
    ['cup', 'cups'], ['clove', 'cloves'], ['can', 'cans'], ['tin', 'tins'], ['jar', 'jars'], ['bottle', 'bottles'],
    ['bag', 'bags'], ['packet', 'packets'], ['package', 'packages'], ['slice', 'slices'], ['piece', 'pieces'],
    ['sprig', 'sprigs'], ['stalk', 'stalks'], ['stick', 'sticks'], ['sheet', 'sheets'], ['head', 'heads'],
    ['bunch', 'bunches'], ['pinch', 'pinches'], ['dash', 'dashes'], ['drop', 'drops'], ['handful', 'handfuls'],
    ['leaf', 'leaves'], ['teaspoon', 'teaspoons'], ['tablespoon', 'tablespoons'], ['ounce', 'ounces'],
    ['pound', 'pounds'], ['pint', 'pints'], ['quart', 'quarts'], ['gallon', 'gallons'], ['gram', 'grams'],
    ['kilogram', 'kilograms'], ['liter', 'liters'], ['litre', 'litres'], ['milliliter', 'milliliters'],
    ['millilitre', 'millilitres'],
  ],
  nl: [
    ['kop', 'koppen'], ['kopje', 'kopjes'], ['teen', 'tenen'], ['teentje', 'teentjes'], ['blik', 'blikken'],
    ['blikje', 'blikjes'], ['pot', 'potten'], ['potje', 'potjes'], ['fles', 'flessen'], ['flesje', 'flesjes'],
    ['zak', 'zakken'], ['zakje', 'zakjes'], ['pak', 'pakken'], ['pakje', 'pakjes'], ['plak', 'plakken'],
    ['plakje', 'plakjes'], ['stuk', 'stuks'], ['takje', 'takjes'], ['steel', 'stelen'], ['stengel', 'stengels'],
    ['vel', 'vellen'], ['velletje', 'velletjes'], ['krop', 'kroppen'], ['bos', 'bossen'], ['bosje', 'bosjes'],
    ['snufje', 'snufjes'], ['scheutje', 'scheutjes'], ['druppel', 'druppels'], ['blaadje', 'blaadjes'],
    ['eetlepel', 'eetlepels'], ['theelepel', 'theelepels'], ['lepel', 'lepels'], ['schijf', 'schijven'],
    ['schijfje', 'schijfjes'], ['partje', 'partjes'], ['bol', 'bollen'], ['bolletje', 'bolletjes'],
  ],
};

const inflections = (forms: [singular: string, plural: string][]) => ({
  plurals: new Map(forms),
  singulars: new Map(forms.map(([singular, plural]) => [plural, singular])),
});
const INFLECTIONS: Record<Language, ReturnType<typeof inflections>> = {
  en: inflections(UNIT_FORMS.en),
  nl: inflections(UNIT_FORMS.nl),
};

const inflectUnit = (unit: string, plural: boolean, language: Language): string => {
  const { plurals, singulars } = INFLECTIONS[language];
  const form = (plural ? plurals : singulars).get(unit.toLowerCase());
  if (!form) return unit;
  const capitalized = unit[0] !== unit[0].toLowerCase();
  return capitalized ? form[0].toUpperCase() + form.slice(1) : form;
};

export interface ScaledIngredient extends Ingredient {
  /** False when the quantity is missing or isn't a plain number, fraction or range; it is then shown as written. */
  scalable: boolean;
}

/**
 * Multiplies an ingredient's quantity by `factor` (selected servings ÷ original servings).
 * At a factor of 1 the ingredient is returned exactly as written. `language` is the language the
 * ingredient is written in, which decides unit plurals and, for Dutch, the decimal comma.
 */
export const scaleIngredient = (ingredient: Ingredient, factor: number, language: Language): ScaledIngredient => {
  const parsed = parseQuantity(ingredient.quantity);
  if (!parsed) return { ...ingredient, scalable: false };
  if (factor === 1) return { ...ingredient, scalable: true };

  const metric = isMetric(ingredient.unit);
  const decimalComma = parsed.decimalComma || language === 'nl';
  const formatted = parsed.amounts.map(amount => formatAmount(amount * factor, metric, decimalComma));
  const texts = [...new Set(formatted.map(amount => amount.text))]; // a range can round to a single amount
  const largest = Math.max(...formatted.map(amount => amount.value));

  return {
    ...ingredient,
    quantity: texts.join(parsed.separator),
    unit: inflectUnit(ingredient.unit, largest > 1, language),
    scalable: true,
  };
};
