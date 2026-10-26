// Tags are stored and filtered by these English names. When you add one, also add its
// display name to every file in locales/ (the type check lists any that are missing).
export const RECIPE_CATEGORIES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Dessert',
  'Snack',
  'Appetizer',
  'Soup',
  'Salad',
  'Pasta',
  'Pizza',
  'Seafood',
  'Chicken',
  'Beef',
  'Pork',
  'Gluten-Free',
  'Asian',
  'Mexican',
  'Italian',
  'Mediterranean',
  'Indian',
  'Baking',
  'Other'
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
