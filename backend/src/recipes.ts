import express, { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { requireAuth } from './auth';
import { HttpError } from './http';
import { LIMITS, getQueryString, normalizeRecipeInput, parseId, titleKey } from './validation';

const router = express.Router();

export const MAX_UPLOAD_RECIPES = 5000;

const requireId = (req: Request): number => {
  const id = parseId(req.params.id);
  if (id === null) throw new HttpError(400, 'Invalid recipe id');
  return id;
};

const requireValidRecipe = (body: unknown) => {
  const result = normalizeRecipeInput(body, 'strict');
  if (!result.ok) throw new HttpError(400, result.errors[0] ?? 'Invalid recipe', result.errors);
  return result.data;
};

router.get('/', async (req: Request, res: Response) => {
  const search = getQueryString(req.query.search)?.slice(0, LIMITS.search);
  const tag = getQueryString(req.query.tags);
  const favorite = getQueryString(req.query.favorite);

  const where: Prisma.RecipeWhereInput = {};

  // Tags are stored as a JSON array string; matching the quoted value avoids partial matches.
  if (tag) where.tags = { contains: JSON.stringify(tag) };
  if (favorite === 'true') where.isFavorite = true;
  if (search) {
    const contains = { contains: search, mode: 'insensitive' as const };
    where.OR = [
      { title: contains },
      { description: contains },
      { ingredients: contains },
      { tags: contains },
      // JSON text, like ingredients, so a Dutch title or ingredient finds the recipe too.
      { translations: contains },
    ];
  }

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  res.json(recipes);
});

router.get('/:id', async (req: Request, res: Response) => {
  const recipe = await prisma.recipe.findUnique({ where: { id: requireId(req) } });
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  res.json(recipe);
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { createdAt: _ignored, ...data } = requireValidRecipe(req.body);
  const recipe = await prisma.recipe.create({ data });
  res.status(201).json(recipe);
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = requireId(req);
  const { createdAt: _ignored, ...data } = requireValidRecipe(req.body);
  // A missing recipe surfaces as Prisma P2025, which the error handler maps to 404.
  const recipe = await prisma.recipe.update({ where: { id }, data });
  res.json(recipe);
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  await prisma.recipe.delete({ where: { id: requireId(req) } });
  res.json({ success: true });
});

router.patch('/:id/favorite', requireAuth, async (req: Request, res: Response) => {
  const id = requireId(req);
  const recipe = await prisma.recipe.findUnique({ where: { id }, select: { isFavorite: true } });
  if (!recipe) throw new HttpError(404, 'Recipe not found');

  const updated = await prisma.recipe.update({
    where: { id },
    data: { isFavorite: !recipe.isFavorite },
  });
  res.json(updated);
});

// Restore from a JSON backup. Recipes whose title already exists (case-insensitive) are skipped,
// and the whole batch is inserted in a single statement so a failure never leaves a partial import.
router.post('/upload', requireAuth, async (req: Request, res: Response) => {
  const recipes: unknown = req.body;
  if (!Array.isArray(recipes)) throw new HttpError(400, 'Expected an array of recipes');
  if (recipes.length > MAX_UPLOAD_RECIPES) {
    throw new HttpError(413, `A backup can contain at most ${MAX_UPLOAD_RECIPES} recipes`);
  }

  const existing = await prisma.recipe.findMany({ select: { title: true } });
  const seenTitles = new Set(existing.map(r => titleKey(r.title)));

  const toCreate: Prisma.RecipeCreateManyInput[] = [];
  let skipped = 0;
  let invalid = 0;

  for (const raw of recipes) {
    const result = normalizeRecipeInput(raw, 'lenient');
    if (!result.ok) {
      invalid++;
      continue;
    }
    const key = titleKey(result.data.title);
    if (seenTitles.has(key)) {
      skipped++;
      continue;
    }
    seenTitles.add(key);
    toCreate.push(result.data);
  }

  const { count } = toCreate.length > 0 ? await prisma.recipe.createMany({ data: toCreate }) : { count: 0 };
  res.status(201).json({ success: true, count, skipped, invalid });
});

export default router;
