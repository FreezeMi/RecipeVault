import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecipeInput, parseId, titleKey, toSafeHttpUrl, LIMITS } from '../../src/validation';

const valid = (input: unknown, mode: 'strict' | 'lenient' = 'strict') => {
  const result = normalizeRecipeInput(input, mode);
  assert.ok(result.ok, `expected valid, got ${JSON.stringify(!result.ok && result.errors)}`);
  return result.data;
};

const invalid = (input: unknown, mode: 'strict' | 'lenient' = 'strict') => {
  const result = normalizeRecipeInput(input, mode);
  assert.ok(!result.ok, 'expected validation to fail');
  return result.errors;
};

test('accepts a full form payload and normalizes it', () => {
  const data = valid({
    title: '  Pancakes  ',
    description: '',
    tags: ['Breakfast', 'breakfast', ' Sweet '],
    prepTime: '10',
    cookTime: 20,
    servings: '',
    imageUrl: 'https://example.com/a.jpg',
    sourceUrl: '',
    ingredients: [{ quantity: '2', unit: 'cups', name: 'flour' }, { quantity: '', unit: '', name: '  ' }],
    instructions: ['Mix', '   ', 'Cook'],
    notes: 'Tasty',
    isFavorite: true,
  });

  assert.equal(data.title, 'Pancakes');
  assert.equal(data.description, null);
  assert.deepEqual(JSON.parse(data.tags), ['Breakfast', 'Sweet']);
  assert.equal(data.prepTime, 10);
  assert.equal(data.cookTime, 20);
  assert.equal(data.servings, null, 'empty strings become null instead of NaN');
  assert.equal(data.sourceUrl, null);
  assert.deepEqual(JSON.parse(data.ingredients), [{ quantity: '2', unit: 'cups', name: 'flour' }]);
  assert.deepEqual(JSON.parse(data.instructions), ['Mix', 'Cook']);
  assert.equal(data.isFavorite, true);
});

test('accepts JSON-string fields as returned by the API (backup format)', () => {
  const data = valid({
    title: 'Soup',
    tags: '["Soup"]',
    ingredients: '[{"quantity":"1","unit":"l","name":"stock"}]',
    instructions: '["Boil"]',
  });
  assert.deepEqual(JSON.parse(data.tags), ['Soup']);
  assert.deepEqual(JSON.parse(data.instructions), ['Boil']);
});

test('treats plain-string ingredients as names', () => {
  const data = valid({ title: 'Toast', ingredients: ['bread', 'butter'] });
  assert.deepEqual(JSON.parse(data.ingredients), [
    { quantity: '', unit: '', name: 'bread' },
    { quantity: '', unit: '', name: 'butter' },
  ]);
});

test('keeps ingredient quantities as written so the app can scale them', () => {
  const quantities = ['1 1/2', '½', '3-4', '2,5', '0.75', 'a pinch', ''];
  const data = valid({
    title: 'x',
    ingredients: [
      ...quantities.map(quantity => ({ quantity: `  ${quantity} `, unit: 'cups', name: 'flour' })),
      { quantity: 2, unit: 'tbsp', name: 'oil' },
      { quantity: '9'.repeat(LIMITS.ingredientQuantity + 5), unit: 'g', name: 'salt' },
    ],
  });
  assert.deepEqual(
    JSON.parse(data.ingredients).map((ingredient: { quantity: string }) => ingredient.quantity),
    [...quantities, '2', '9'.repeat(LIMITS.ingredientQuantity)],
  );
});

test('servings is a whole number from 1 to 1000, the baseline for scaling ingredients', () => {
  assert.equal(valid({ title: 'x', servings: 1 }).servings, 1);
  assert.equal(valid({ title: 'x', servings: LIMITS.servings }).servings, LIMITS.servings);
  assert.equal(valid({ title: 'x', servings: ' 12 ' }).servings, 12);
  for (const servings of [2.5, '2.5', 0, -4, LIMITS.servings + 1, true]) {
    assert.deepEqual(
      invalid({ title: 'x', servings }),
      [`servings must be a whole number between 1 and ${LIMITS.servings}.`],
      `servings: ${String(servings)}`,
    );
  }
  // Restoring an old backup drops a bad serving count instead of rejecting the recipe.
  assert.equal(valid({ title: 'x', servings: 2.5 }, 'lenient').servings, null);
});

test('requires a title', () => {
  assert.deepEqual(invalid({ title: '   ' }), ['Title is required.']);
  assert.deepEqual(invalid({}), ['Title is required.']);
  assert.ok(!normalizeRecipeInput({ title: 42 }, 'lenient').ok);
});

test('rejects non-object payloads', () => {
  for (const input of [null, 'title', 42, ['a']]) invalid(input);
});

test('rejects unsafe or malformed URLs in strict mode', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'not a url', 'ftp://example.com/x']) {
    const errors = invalid({ title: 'x', sourceUrl: url });
    assert.match(errors[0]!, /sourceUrl must be a valid http\(s\) URL/);
  }
});

test('drops unsafe URLs in lenient (restore) mode instead of rejecting the recipe', () => {
  const data = valid({ title: 'x', imageUrl: 'javascript:alert(1)', sourceUrl: 'https://ok.example/' }, 'lenient');
  assert.equal(data.imageUrl, null);
  assert.equal(data.sourceUrl, 'https://ok.example/');
});

test('validates numeric ranges', () => {
  invalid({ title: 'x', prepTime: -1 });
  invalid({ title: 'x', cookTime: 1.5 });
  invalid({ title: 'x', servings: 0 });
  invalid({ title: 'x', servings: 'four' });
  invalid({ title: 'x', prepTime: LIMITS.minutes + 1 });
  assert.equal(valid({ title: 'x', prepTime: 0 }).prepTime, 0, 'zero minutes is a real value');
});

test('enforces length limits strictly and truncates leniently', () => {
  const longTitle = 'a'.repeat(LIMITS.title + 1);
  invalid({ title: longTitle });
  assert.equal(valid({ title: longTitle }, 'lenient').title.length, LIMITS.title);
});

test('rejects wrong types in strict mode', () => {
  invalid({ title: 'x', tags: 'not json' });
  invalid({ title: 'x', tags: [1, 2] });
  invalid({ title: 'x', ingredients: { name: 'x' } });
  invalid({ title: 'x', instructions: [{ step: 1 }] });
  invalid({ title: 'x', isFavorite: 'yes' });
  invalid({ title: 'x', description: 5 });
});

test('only keeps createdAt for restores, and only valid past dates', () => {
  const past = '2024-01-02T03:04:05.000Z';
  assert.equal(valid({ title: 'x', createdAt: past }).createdAt, undefined);
  assert.equal(valid({ title: 'x', createdAt: past }, 'lenient').createdAt?.toISOString(), past);
  assert.equal(valid({ title: 'x', createdAt: 'garbage' }, 'lenient').createdAt, undefined);
  assert.equal(valid({ title: 'x', createdAt: '2999-01-01T00:00:00Z' }, 'lenient').createdAt, undefined);
});

const dutch = {
  title: '  Pannenkoeken ',
  description: 'Luchtig',
  ingredients: [{ quantity: '2', unit: 'kopjes', name: 'bloem' }, { quantity: '', unit: '', name: ' ' }],
  instructions: ['Mengen', '  ', 'Bakken'],
  notes: '',
};

test('language and translations are left out when the payload does not mention them', () => {
  // An update from a client that doesn't know about languages must not wipe stored translations.
  const data = valid({ title: 'x' });
  assert.equal('language' in data, false);
  assert.equal('translations' in data, false);
});

test('language must be a supported language', () => {
  assert.equal(valid({ title: 'x', language: 'nl' }).language, 'nl');
  for (const language of ['fr', 'NL', '', null, 1]) {
    assert.deepEqual(invalid({ title: 'x', language }), ['language must be one of: en, nl.'], `language: ${String(language)}`);
  }
  // A restored backup with an unknown language falls back to the database default.
  assert.equal(valid({ title: 'x', language: 'fr' }, 'lenient').language, undefined);
});

test('translations are normalized like the recipe text and stored as JSON keyed by language', () => {
  const data = valid({ title: 'Pancakes', language: 'en', translations: { nl: dutch } });
  assert.deepEqual(JSON.parse(data.translations!), {
    nl: {
      title: 'Pannenkoeken',
      description: 'Luchtig',
      ingredients: [{ quantity: '2', unit: 'kopjes', name: 'bloem' }],
      instructions: ['Mengen', 'Bakken'],
      notes: null,
    },
  });
});

test('translations accept the JSON string returned by the API (backup format)', () => {
  const stored = valid({ title: 'Pancakes', translations: { nl: dutch } }).translations!;
  assert.equal(valid({ title: 'Pancakes', translations: stored }).translations, stored);
});

test('null or empty translations clear them', () => {
  for (const translations of [null, '', {}]) {
    assert.equal(valid({ title: 'x', translations }).translations, null, `translations: ${JSON.stringify(translations)}`);
  }
});

test('rejects unusable translations in strict mode, naming the language', () => {
  assert.deepEqual(invalid({ title: 'x', translations: 'not json' }), ['translations must be an object keyed by language.']);
  assert.deepEqual(invalid({ title: 'x', translations: ['nl'] }), ['translations must be an object keyed by language.']);
  assert.deepEqual(invalid({ title: 'x', translations: { fr: dutch } }), ['translations has unsupported languages: fr.']);
  assert.deepEqual(invalid({ title: 'x', language: 'nl', translations: { nl: dutch } }), [
    "translations cannot include the recipe's own language (nl).",
  ]);
  assert.deepEqual(invalid({ title: 'x', translations: { nl: { ...dutch, title: ' ' } } }), ['translations.nl: Title is required.']);
  assert.deepEqual(invalid({ title: 'x', translations: { nl: 'Pannenkoeken' } }), ['translations.nl: must be an object.']);
  assert.deepEqual(invalid({ title: 'x', translations: { nl: { ...dutch, title: 'a'.repeat(LIMITS.title + 1) } } }), [
    `translations.nl: title must be at most ${LIMITS.title} characters.`,
  ]);
});

test('drops unusable translations in lenient (restore) mode but keeps the recipe', () => {
  const data = valid(
    { title: 'x', language: 'en', translations: { en: dutch, fr: dutch, nl: { ...dutch, title: '' } } },
    'lenient',
  );
  assert.equal(data.translations, null);

  const repaired = valid({ title: 'x', translations: { nl: { ...dutch, title: 'a'.repeat(LIMITS.title + 1) } } }, 'lenient');
  assert.equal(JSON.parse(repaired.translations!).nl.title.length, LIMITS.title);
});

test('parseId accepts only positive int32 strings', () => {
  assert.equal(parseId('42'), 42);
  for (const value of ['0', '-1', 'abc', '1.5', '1e3', '99999999999', '', undefined, 5]) {
    assert.equal(parseId(value), null, `parseId(${String(value)})`);
  }
});

test('toSafeHttpUrl and titleKey helpers', () => {
  assert.equal(toSafeHttpUrl(' https://example.com/x '), 'https://example.com/x');
  assert.equal(toSafeHttpUrl('JAVASCRIPT:alert(1)'), null);
  assert.equal(titleKey('  Apple   Pie '), 'apple pie');
});
