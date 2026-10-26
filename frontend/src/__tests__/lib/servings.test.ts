import { describe, expect, test } from 'vitest';
import { scaleIngredient, servingOptions } from '../../lib/servings';

/** Scales "quantity unit" and returns how it would read, e.g. scale('1/2', 'cup', 2) → "1 cup". */
const scale = (quantity: string, unit: string, factor: number) => {
  const scaled = scaleIngredient({ quantity, unit, name: 'x' }, factor);
  return [scaled.quantity, scaled.unit].filter(Boolean).join(' ');
};

describe('servingOptions', () => {
  test('offers 1–12', () => {
    expect(servingOptions(4)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test("keeps a larger recipe yield selectable so it can be shown as written", () => {
    expect(servingOptions(24)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24]);
  });
});

describe('scaleIngredient', () => {
  test('returns the ingredient exactly as written at its own serving size', () => {
    expect(scaleIngredient({ quantity: '0.5', unit: 'cups', name: 'milk' }, 1)).toEqual({
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
  });

  test('matches count units to the new amount and keeps their capitalization', () => {
    expect(scale('2', 'cloves', 1 / 4)).toBe('½ clove');
    expect(scale('1', 'Cup', 2)).toBe('2 Cups');
    expect(scale('1', 'leaf', 3)).toBe('3 leaves');
    expect(scale('2', 'cm piece', 1 / 2)).toBe('1 cm piece');
  });

  test.each(['a pinch', '2 large', 'to taste', '1,000', '0', '1/0', '1-1/2', '4-3', 'about 2'])(
    'leaves "%s" as written',
    quantity => {
      expect(scaleIngredient({ quantity, unit: 'cups', name: 'x' }, 2)).toEqual({
        quantity,
        unit: 'cups',
        name: 'x',
        scalable: false,
      });
    },
  );

  test('leaves ingredients without a quantity untouched', () => {
    expect(scaleIngredient({ quantity: '', unit: '', name: 'salt to taste' }, 3)).toEqual({
      quantity: '',
      unit: '',
      name: 'salt to taste',
      scalable: false,
    });
  });
});
