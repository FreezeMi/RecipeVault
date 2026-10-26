import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const recipes = [
    {
      title: 'Thai Peanut Chicken',
      description: 'This delicious Thai Peanut Chicken is positively PACKED with flavor! Quick and easy to make and thoroughly satisfying!',
      tags: JSON.stringify(['Asian', 'Chicken', 'Dinner']),
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
      translations: JSON.stringify({
        nl: {
          title: 'Thaise pindakip',
          description: 'Deze Thaise pindakip zit bomvol smaak! Snel en makkelijk te maken en heerlijk vullend.',
          ingredients: [
            { quantity: '2', unit: 'el', name: 'bakolie' },
            { quantity: '1', unit: '', name: 'gele ui, gesnipperd' },
            { quantity: '2', unit: 'teentjes', name: 'knoflook, fijngehakt' },
            { quantity: '2,5', unit: 'cm', name: 'verse gember, fijngehakt' },
            { quantity: '455', unit: 'g', name: 'kipfilet, in hapklare stukjes' },
            { quantity: '2', unit: 'el', name: 'zoete chilisaus' },
            { quantity: '2', unit: 'el', name: 'tomatensaus of ketchup' },
            { quantity: '3', unit: 'el', name: 'pindakaas met stukjes noot' },
            { quantity: '1', unit: 'el', name: 'chilipoeder' },
            { quantity: '1', unit: 'tl', name: 'donkerbruine suiker (optioneel)' },
            { quantity: '396', unit: 'g', name: 'ongezoete kokosmelk' },
            { quantity: '1', unit: 'tl', name: 'zout' },
            { quantity: '', unit: '', name: 'Gehakte verse koriander, voor de garnering' },
            { quantity: '', unit: '', name: "Gehakte geroosterde pinda's, voor de garnering" },
          ],
          instructions: [
            'Verhit de olie in een koekenpan op middelhoog vuur en bak de ui in 5 minuten zacht en glazig. Voeg de knoflook en gember toe en bak nog 2 minuten. Voeg de kip toe en bak 3-4 minuten.',
            'Voeg de zoete chilisaus, tomatensaus of ketchup, chilipoeder, pindakaas en suiker toe en roer alles goed door.',
            'Voeg de kokosmelk en het zout toe en breng aan de kook. Zet het vuur middellaag, leg de deksel op de pan en laat 20 minuten sudderen; roer af en toe. Is de saus te dun naar je zin? Los dan een eetlepel maïzena op in 2 eetlepels water, roer het door de saus en laat nog een minuut sudderen tot de saus is ingedikt. Breng op smaak met zout.',
            "Serveer met gestoomde rijst en garneer met koriander en gehakte geroosterde pinda's.",
          ],
          notes: 'Recept van Kimberly Killebrew. Zelfgemaakt chilipoeder wordt sterk aanbevolen.',
        },
      }),
    },
    {
      title: 'Easy 15-Minute Sweet and Sour Chicken',
      description: 'Faster, tastier, healthier, and better than takeout! Perfect for busy weeknights when you need a quick dinner.',
      tags: JSON.stringify(['Asian', 'Chicken', 'Dinner']),
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
      translations: JSON.stringify({
        nl: {
          title: 'Snelle zoetzure kip in 15 minuten',
          description: 'Sneller, lekkerder, gezonder en beter dan afhaal! Perfect voor drukke doordeweekse avonden als je snel wilt eten.',
          ingredients: [
            { quantity: '150', unit: 'g', name: 'kristalsuiker' },
            { quantity: '120', unit: 'ml', name: 'appelazijn' },
            { quantity: '60', unit: 'ml', name: 'ketchup' },
            { quantity: '2', unit: 'el', name: 'sojasaus met minder zout' },
            { quantity: '1', unit: 'el', name: 'sesamolie' },
            { quantity: '15', unit: 'g', name: 'lichtbruine basterdsuiker' },
            { quantity: '3', unit: 'teentjes', name: 'knoflook, fijngehakt' },
            { quantity: '2', unit: 'el', name: 'koud water' },
            { quantity: '1', unit: 'el', name: 'maïzena' },
            { quantity: '570', unit: 'g', name: 'kipfilet (in stukjes van 2,5 cm)' },
            { quantity: '3', unit: 'el', name: 'maïzena' },
            { quantity: '', unit: '', name: 'zout en peper (naar smaak)' },
            { quantity: '3-4', unit: 'el', name: 'olijfolie' },
            { quantity: '2', unit: '', name: 'lente-uitjes (in ringetjes)' },
            { quantity: '1', unit: 'el', name: 'sesamzaad (optioneel)' },
          ],
          instructions: [
            'Doe alle ingrediënten voor de saus behalve het water en de maïzena in een middelgrote steelpan, klop door elkaar en breng aan de kook op middelhoog vuur.',
            'Meng het water en de maïzena in een kommetje.',
            'Voeg het maïzenamengsel toe aan de steelpan, zet het vuur laag en laat de saus ongeveer 5 minuten sudderen terwijl je de kip bakt; klop af en toe door.',
            'Doe de kip, de maïzena en zout en peper naar smaak in een grote vershoudzak, sluit hem en schud tot de kip gelijkmatig bedekt is.',
            'Verhit 3 tot 4 eetlepels olijfolie in een grote koekenpan, voeg de kip toe en bak 5 tot 7 minuten op middelhoog vuur, tot de kip gaar is. Roer en keer af en toe zodat alles gelijkmatig gaar wordt.',
            'Zet het vuur laag zodra de kip gaar is, voeg de saus toe, roer tot alles bedekt is en laat een minuut of twee sudderen.',
            'Garneer eventueel met lente-ui en sesamzaad en serveer direct.',
          ],
          notes: 'Recept van Averie Sunshine.',
        },
      }),
    }
  ];

  // Never delete existing data: only add starter recipes whose title isn't in the vault yet.
  const existing = await prisma.recipe.findMany({ select: { title: true } })
  const existingTitles = new Set(existing.map((r) => r.title.trim().toLowerCase()))
  const missing = recipes.filter((r) => !existingTitles.has(r.title.trim().toLowerCase()))

  if (missing.length > 0) {
    await prisma.recipe.createMany({ data: missing })
  }

  console.log(`Seed complete: added ${missing.length} recipe(s), ${recipes.length - missing.length} already present.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
