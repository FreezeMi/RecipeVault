import { describe, expect, test } from 'vitest';
import { en } from '../../locales/en';
import { nl } from '../../locales/nl';
import {
  formatMinutes,
  hostnameOf,
  parseIngredients,
  parseInstructions,
  parseTags,
  safeHttpUrl,
  totalMinutes,
} from '../../lib/recipe';

describe('recipe parsing', () => {
  test('parseTags tolerates null, bad JSON and non-string entries', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags('not json')).toEqual([]);
    expect(parseTags('{"a":1}')).toEqual([]);
    expect(parseTags('["Dinner", 3, "", "Pasta"]')).toEqual(['Dinner', 'Pasta']);
  });

  test('parseIngredients accepts objects and legacy plain strings', () => {
    expect(parseIngredients('[{"quantity":"2","unit":"cups","name":"flour"}, "salt", {"name":""}, 42]')).toEqual([
      { quantity: '2', unit: 'cups', name: 'flour' },
      { quantity: '', unit: '', name: 'salt' },
    ]);
  });

  test('parseInstructions drops blank steps', () => {
    expect(parseInstructions('["Mix", "  ", "Bake"]')).toEqual(['Mix', 'Bake']);
  });
});

describe('formatting', () => {
  test('totalMinutes is null only when both times are unknown', () => {
    expect(totalMinutes({ prepTime: null, cookTime: null })).toBeNull();
    expect(totalMinutes({ prepTime: 10, cookTime: null })).toBe(10);
    expect(totalMinutes({ prepTime: 10, cookTime: 20 })).toBe(30);
  });

  test('formatMinutes uses hours past 60 minutes', () => {
    expect(formatMinutes(45, en)).toBe('45 min');
    expect(formatMinutes(60, en)).toBe('1 h');
    expect(formatMinutes(95, en)).toBe('1 h 35 min');
  });

  test('formatMinutes in Dutch abbreviates hours as "u"', () => {
    expect(formatMinutes(45, nl)).toBe('45 min');
    expect(formatMinutes(60, nl)).toBe('1 u');
    expect(formatMinutes(95, nl)).toBe('1 u 35 min');
  });

  test('servings pluralize in both languages', () => {
    expect(en.format.servings(1)).toBe('1 serving');
    expect(en.format.servings(4)).toBe('4 servings');
    expect(nl.format.servings(1)).toBe('1 persoon');
    expect(nl.format.servings(4)).toBe('4 personen');
  });
});

describe('safeHttpUrl', () => {
  test('allows http(s) only', () => {
    expect(safeHttpUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl(' JavaScript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(safeHttpUrl('/relative')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  test('hostnameOf strips www', () => {
    expect(hostnameOf('https://www.example.com/recipe')).toBe('example.com');
  });
});
