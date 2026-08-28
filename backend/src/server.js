"use strict";
const __createBinding = Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    let desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
const __setModuleDefault = Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
};
const __importStar = (function () {
    let ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            let ar = [];
            for (let k in o) if (Object.hasOwn(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod?.['__esModule']) return mod;
        const result = {};
        if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const __importDefault = function (mod) {
    return mod?.__esModule ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const client_1 = require("@prisma/client");
const auth_1 = __importStar(require("./auth"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use((0, cors_1.default)({
    origin: FRONTEND_URL,
    credentials: true
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use('/api/auth', auth_1.default);
// Get all recipes
app.get('/api/recipes', async (req, res) => {
    try {
        const { search, category, favorite } = req.query;
        let where = {};
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
    }
    catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ error: 'Failed to fetch recipes' });
    }
});
// Get a single recipe
app.get('/api/recipes/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const recipe = await prisma.recipe.findUnique({ where: { id } });
        if (!recipe) {
            res.status(404).json({ error: 'Recipe not found' });
            return;
        }
        res.json(recipe);
    }
    catch (error) {
        console.error('Error fetching recipe:', error);
        res.status(500).json({ error: 'Failed to fetch recipe' });
    }
});
// Create a recipe
app.post('/api/recipes', auth_1.requireAuth, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error creating recipe:', error);
        res.status(500).json({ error: 'Failed to create recipe' });
    }
});
// Update a recipe
app.put('/api/recipes/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
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
    }
    catch (error) {
        console.error('Error updating recipe:', error);
        res.status(500).json({ error: 'Failed to update recipe' });
    }
});
// Delete a recipe
app.delete('/api/recipes/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        await prisma.recipe.delete({ where: { id } });
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).json({ error: 'Failed to delete recipe' });
    }
});
// Toggle favorite
app.patch('/api/recipes/:id/favorite', auth_1.requireAuth, async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
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
    }
    catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map