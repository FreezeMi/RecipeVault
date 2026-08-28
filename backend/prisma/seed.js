"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    await prisma.recipe.deleteMany({});
    const recipes = [
        {
            title: 'Thai Peanut Chicken',
            description: 'This delicious Thai Peanut Chicken is positively PACKED with flavor! Quick and easy to make and thoroughly satisfying!',
            category: 'Asian',
            prepTime: 10,
            cookTime: 30,
            servings: 4,
            imageUrl: 'https://www.daringgourmet.com/wp-content/uploads/2015/04/Thai-Peanut-Chicken-2.jpg',
            sourceUrl: 'https://www.daringgourmet.com/chili-peanut-coconut-chicken/',
            ingredients: JSON.stringify([
                { quantity: '2', unit: 'tbsp', name: 'cooking oil' },
                { quantity: '1', unit: '', name: 'yellow onion, chopped' },
                { quantity: '2', unit: 'cloves', name: 'garlic, minced' },
                { quantity: '2.5', unit: 'cm piece', name: 'ginger root, minced' },
                { quantity: '455', unit: 'g', name: 'chicken breast, cut into bite-sized pieces' },
                { quantity: '2', unit: 'tbsp', name: 'sweet chili sauce' },
                { quantity: '2', unit: 'tbsp', name: 'tomato sauce or ketchup' },
                { quantity: '3', unit: 'tbsp', name: 'crunchy peanut butter' },
                { quantity: '1', unit: 'tbsp', name: 'chili powder' },
                { quantity: '1', unit: 'tsp', name: 'dark brown sugar (optional)' },
                { quantity: '396', unit: 'g', name: 'unsweetened coconut milk' },
                { quantity: '1', unit: 'tsp', name: 'salt' },
                { quantity: '', unit: '', name: 'Chopped fresh cilantro for garnish' },
                { quantity: '', unit: '', name: 'Chopped roasted peanuts for garnish' },
            ]),
            instructions: JSON.stringify([
                'Heat the oil in skillet over medium-high heat and cook the onions until soft and translucent, 5 minutes. Add the garlic and ginger and cook for another 2 minutes. Add the chicken and cook for 3-4 minutes.',
                'Add the sweet chili sauce, tomato sauce or ketchup, chili powder, peanut butter, and sugar and stir to combine.',
                'Add the coconut milk and salt and bring to a boil. Reduce the heat to medium-low, cover and simmer for 20 minutes, stirring occasionally. If the sauce is too thin for your liking, dissolve a tablespoon of cornstarch in 2 tablespoons of water, stir it into the sauce, and simmer or another minute until thickened. Add salt to taste.',
                'Serve over steamed rice garnished with cilantro and chopped roasted peanuts.'
            ]),
            notes: 'Recipe by Kimberly Killebrew. Highly recommended to use homemade chili powder.',
        },
        {
            title: 'Easy 15-Minute Sweet and Sour Chicken',
            description: 'Faster, tastier, healthier, and better than takeout! Perfect for busy weeknights when you need a quick dinner.',
            category: 'Asian',
            prepTime: 5,
            cookTime: 10,
            servings: 4,
            imageUrl: 'https://www.averiecooks.com/wp-content/uploads/2017/01/sweetsourchicken-10.jpg',
            sourceUrl: 'https://www.averiecooks.com/easy-15-minute-sweet-sour-chicken/',
            ingredients: JSON.stringify([
                { quantity: '150', unit: 'g', name: 'granulated sugar' },
                { quantity: '120', unit: 'ml', name: 'apple cider vinegar' },
                { quantity: '60', unit: 'ml', name: 'ketchup' },
                { quantity: '2', unit: 'tbsp', name: 'low-sodium soy sauce' },
                { quantity: '1', unit: 'tbsp', name: 'sesame oil' },
                { quantity: '15', unit: 'g', name: 'light brown sugar' },
                { quantity: '3', unit: 'cloves', name: 'garlic, minced' },
                { quantity: '2', unit: 'tbsp', name: 'cold water' },
                { quantity: '1', unit: 'tbsp', name: 'cornstarch' },
                { quantity: '570', unit: 'g', name: 'boneless skinless chicken breasts (cut into 2.5cm pieces)' },
                { quantity: '3', unit: 'tbsp', name: 'cornstarch' },
                { quantity: '', unit: '', name: 'salt and pepper (to taste)' },
                { quantity: '3-4', unit: 'tbsp', name: 'olive oil' },
                { quantity: '2', unit: '', name: 'green onions (sliced)' },
                { quantity: '1', unit: 'tbsp', name: 'sesame seeds (optional)' }
            ]),
            instructions: JSON.stringify([
                'To a medium saucepan, add all ingredients except water and cornstarch, whisk to combine, and bring to a boil over medium-high heat.',
                'To a small bowl, add the water, cornstarch, and stir to combine.',
                'Add the water and cornstarch mixture to saucepan, reduce heat to low, and allow sauce to simmer for about 5 minutes while you make the chicken; whisk intermittently.',
                'To a large ziptop bag, add the chicken, cornstarch, salt and pepper to taste, seal, and shake to coat chicken evenly.',
                'To a large skillet, add 3 to 4 tablespoons olive oil, chicken, and cook over medium-high heat for about 5 to 7 minutes, or until chicken has cooked through. Stir and flip intermittently to ensure even cooking.',
                'After chicken has cooked though, reduce heat to low, add the sauce, stir to coat evenly, and allow it to simmer for a minute or two.',
                'Optionally garnish with green onions, sesame seeds, and serve immediately.'
            ]),
            notes: 'Recipe by Averie Sunshine.',
        }
    ];
    for (const recipe of recipes) {
        await prisma.recipe.create({
            data: recipe,
        });
    }
    console.log('Seeded database successfully');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map