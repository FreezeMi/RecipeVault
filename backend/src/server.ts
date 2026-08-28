import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Get all recipes
app.get('/api/recipes', async (req: Request, res: Response) => {
  try {
    const { search, category, favorite } = req.query;
    let where: any = {};
    
    if (category) {
      where.category = String(category);
    }
    
    if (favorite === 'true') {
      where.isFavorite = true;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: String(search) } },
        { description: { contains: String(search) } },
        { ingredients: { contains: String(search) } }
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
    const id = parseInt(req.params.id, 10);
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
app.post('/api/recipes', async (req: Request, res: Response) => {
  try {
    const { title, description, category, prepTime, cookTime, servings, imageUrl, ingredients, instructions, notes, isFavorite } = req.body;
    
    if (!title) {
       res.status(400).json({ error: 'Title is required' });
       return;
    }
    
    const recipe = await prisma.recipe.create({
      data: {
        title,
        description,
        category,
        prepTime: prepTime ? parseInt(prepTime, 10) : null,
        cookTime: cookTime ? parseInt(cookTime, 10) : null,
        servings: servings ? parseInt(servings, 10) : null,
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
app.put('/api/recipes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, category, prepTime, cookTime, servings, imageUrl, ingredients, instructions, notes, isFavorite } = req.body;
    
    if (!title) {
       res.status(400).json({ error: 'Title is required' });
       return;
    }
    
    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        title,
        description,
        category,
        prepTime: prepTime !== undefined ? parseInt(prepTime, 10) : null,
        cookTime: cookTime !== undefined ? parseInt(cookTime, 10) : null,
        servings: servings !== undefined ? parseInt(servings, 10) : null,
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
app.delete('/api/recipes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.recipe.delete({ where: { id } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Toggle favorite
app.patch('/api/recipes/:id/favorite', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
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

