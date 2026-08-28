import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import authRouter, { requireAuth } from './auth';

dotenv.config();

const app = express();
app.disable('x-powered-by');

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);

// Get all recipes
const getQueryString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
};

app.get('/api/recipes', async (req: Request, res: Response) => {
  try {
    const search = getQueryString(req.query.search);
    const tags = getQueryString(req.query.tags);
    const favorite = getQueryString(req.query.favorite);
    let where: any = {};
    
    if (tags) {
      where.tags = { contains: tags };
    }
    
    if (favorite === 'true') {
      where.isFavorite = true;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { ingredients: { contains: search } },
        { tags: { contains: search } }
      ];
    }

    const recipes = await prisma.recipe.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Get a single recipe
app.get('/api/recipes/:id', async (req: Request, res: Response) => {
  try {
    const id = Number.parseInt(req.params.id as string, 10);
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    
    if (!recipe) {
       res.status(404).json({ error: 'Recipe not found' });
       return;
    }
    
    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// Create a recipe
app.post('/api/recipes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, description, tags, prepTime, cookTime, servings, imageUrl, ingredients, instructions, notes, isFavorite } = req.body;
    
    if (!title) {
       res.status(400).json({ error: 'Title is required' });
       return;
    }
    
    const recipe = await prisma.recipe.create({
      data: {
        title,
        description,
        tags: JSON.stringify(tags || []),
        prepTime: prepTime ? Number.parseInt(prepTime, 10) : null,
        cookTime: cookTime ? Number.parseInt(cookTime, 10) : null,
        servings: servings ? Number.parseInt(servings, 10) : null,
        imageUrl,
        ingredients: JSON.stringify(ingredients || []),
        instructions: JSON.stringify(instructions || []),
        notes,
        isFavorite: isFavorite || false
      }
    });
    
    res.status(201).json(recipe);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// Update a recipe
app.put('/api/recipes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number.parseInt(req.params.id as string, 10);
    const { title, description, tags, prepTime, cookTime, servings, imageUrl, ingredients, instructions, notes, isFavorite } = req.body;
    
    if (!title) {
       res.status(400).json({ error: 'Title is required' });
       return;
    }
    
    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        title,
        description,
        tags: JSON.stringify(tags || []),
        prepTime: prepTime !== undefined ? Number.parseInt(prepTime, 10) : null,
        cookTime: cookTime !== undefined ? Number.parseInt(cookTime, 10) : null,
        servings: servings !== undefined ? Number.parseInt(servings, 10) : null,
        imageUrl,
        ingredients: JSON.stringify(ingredients || []),
        instructions: JSON.stringify(instructions || []),
        notes,
        isFavorite
      }
    });
    
    res.json(recipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// Delete a recipe
app.delete('/api/recipes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number.parseInt(req.params.id as string, 10);
    await prisma.recipe.delete({ where: { id } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Toggle favorite
app.patch('/api/recipes/:id/favorite', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number.parseInt(req.params.id as string, 10);
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    
    if (!recipe) {
       res.status(404).json({ error: 'Recipe not found' });
       return;
    }
    
    const updatedRecipe = await prisma.recipe.update({
      where: { id },
      data: { isFavorite: !recipe.isFavorite }
    });
    
    res.json(updatedRecipe);
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

