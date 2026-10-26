import { describe, expect, test } from 'vitest';
import { scaleIngredient, servingOptions } from '../../lib/servings';
import type { Language } from '../../lib/i18n';

/** Scales "quantity unit" and returns how it would read, e.g. scale('1/2', 'cup', 2) → "1 cup". */
const scale = (quantity: string, unit: string, factor: number, language: Language = 'en') => {
  const scaled = scaleIngredient({ quantity, unit, name: 'x' }, factor, language);
  return [scaled.quantity, scaled.unit].filter(Boolean).join(' ');
};

describe('servingOptions', () => {
  test('offers 1–12', () => {
    expect(servingOptions(4)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(servingOptions(12)).toEqual(servingOptions(1));
  });

  test("keeps a larger recipe yield selectable so it can be shown as written", () => {
    expect(servingOptions(24)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24]);
  });
});

describe('scaleIngredient', () => {
  test('returns the ingredient exactly as written at its own serving size', () => {
    expect(scaleIngredient({ quantity: '0.5', unit: 'cups', name: 'milk' }, 1, 'en')).toEqual({
      quantity: '0.5',
      unit: 'cups',
      name: 'milk',
      scalable: true,
    });
  });

  test('scales whole numbers and decimals', () => {
    expect(scale('2', 'tbsp', 1.5)).toBe('3 tbsp');
    expect(scale('2', '', 3)).toBe('6');
    expect(scale('0.5', 'tsp', 3)).toBe('1½ tsp');
    expect(scale('.5', 'tsp', 2)).toBe('1 tsp');
  });

  test('rounds metric amounts to sensible decimals instead of fractions', () => {
    expect(scale('455', 'g', 1 / 4)).toBe('114 g');
    expect(scale('150', 'g', 1 / 4)).toBe('37.5 g');
    expect(scale('1', 'kg', 1 / 3)).toBe('0.33 kg');
    expect(scale('120', 'ml', 1.5)).toBe('180 ml');
  });

  test('keeps a decimal comma', () => {
    expect(scale('1,5', 'l', 1 / 2)).toBe('0,75 l');
    expect(scale('2,5', 'dl', 2)).toBe('5 dl');
    expect(scale('1,5-2', 'l', 1 / 2)).toBe('0,75-1 l');
  });

  test('rounds amounts of 100 or more to whole numbers, whatever the unit', () => {
    expect(scale('455', '', 1 / 4)).toBe('114');
  });

  test('shows tiny amounts instead of rounding them to zero', () => {
    expect(scale('0.1', 'tsp', 1 / 12)).toBe('0.01 tsp');
    expect(scale('1', 'g', 1 / 1000)).toBe('0.001 g');
  });

  test('normalizes spacing and the unicode fraction slash', () => {
    expect(scale(' 1  1/2 ', 'cups', 2)).toBe('3 cups');
    expect(scale('1⁄2', 'cup', 2)).toBe('1 cup');
  });

  test('reads fractions, mixed numbers and unicode fractions', () => {
    expect(scale('1/2', 'cup', 2)).toBe('1 cup');
    expect(scale('1 1/2', 'cups', 2)).toBe('3 cups');
    expect(scale('¾', 'cup', 2)).toBe('1½ cups');
    expect(scale('1½', 'cups', 1 / 3)).toBe('½ cup');
    expect(scale('1 ½', 'cups', 2)).toBe('3 cups');
  });

  test('shows non-metric results as kitchen fractions, falling back to decimals', () => {
    expect(scale('1', 'cup', 1 / 3)).toBe('⅓ cup');
    expect(scale('3', 'tbsp', 5 / 4)).toBe('3¾ tbsp');
    expect(scale('1', 'cup', 1 / 6)).toBe('0.17 cup');
  });

  test('scales both ends of a range and keeps its separator', () => {
    expect(scale('3-4', 'tbsp', 2)).toBe('6-8 tbsp');
    expect(scale('1 to 2', 'cups', 1 / 2)).toBe('½ to 1 cup');
    expect(scale('2 – 3', '', 2)).toBe('4 – 6');
    expect(scale('1 TO 2', 'cups', 2)).toBe('2 TO 4 cups');
  });

  test('shows a range that rounds to one amount as that amount', () => {
    expect(scale('100-100.2', 'g', 2)).toBe('200 g');
  });

  test('matches count units to the new amount and keeps their capitalization', () => {
    expect(scale('2', 'cloves', 1 / 4)).toBe('½ clove');
    expect(scale('1', 'Cup', 2)).toBe('2 Cups');
    expect(scale('2', 'Cups', 1 / 2)).toBe('1 Cup');
    expect(scale('2', 'large', 2)).toBe('4 large');
    expect(scale('1', 'leaf', 3)).toBe('3 leaves');
    expect(scale('2', 'cm piece', 1 / 2)).toBe('1 cm piece');
  });

  test.each(['a pinch', '2 large', 'to taste', '1,000', '0', '1/0', '1-1/2', '4-3', 'about 2'])(
    'leaves "%s" as written',
    quantity => {
      expect(scaleIngredient({ quantity, unit: 'cups', name: 'x' }, 2, 'en')).toEqual({
        quantity,
        unit: 'cups',
        name: 'x',
        scalable: false,
      });
    },
  );

  test('never changes the ingredient it is given', () => {
    const stored = Object.freeze({ quantity: '2', unit: 'cups', name: 'flour' });
    expect(scaleIngredient(stored, 3, 'en').quantity).toBe('6');
    expect(stored).toEqual({ quantity: '2', unit: 'cups', name: 'flour' });
  });

  test('in Dutch, inflects Dutch units, keeps metric words as they are and uses a decimal comma', () => {
    expect(scale('1', 'teentje', 2, 'nl')).toBe('2 teentjes');
    expect(scale('2', 'teentjes', 1 / 2, 'nl')).toBe('1 teentje');
    expect(scale('1', 'Blik', 3, 'nl')).toBe('3 Blikken');
    expect(scale('100', 'gram', 2, 'nl')).toBe('200 gram');
    expect(scale('1', 'liter', 3, 'nl')).toBe('3 liter');
    expect(scale('1', 'l', 1.5, 'nl')).toBe('1,5 l');
    expect(scale('2 tot 3', 'el', 2, 'nl')).toBe('4 tot 6 el');
    // English words are left alone in Dutch text, and Dutch ones in English text.
    expect(scale('1', 'cup', 2, 'nl')).toBe('2 cup');
    expect(scale('1', 'teentje', 2, 'en')).toBe('2 teentje');
    expect(scale('100', 'gram', 2, 'en')).toBe('200 grams');
  });

  test('leaves ingredients without a quantity untouched', () => {
    expect(scaleIngredient({ quantity: '', unit: '', name: 'salt to taste' }, 3, 'en')).toEqual({
      quantity: '',
      unit: '',
      name: 'salt to taste',
      scalable: false,
    });
  });
});
