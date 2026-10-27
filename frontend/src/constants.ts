// Tags are stored and filtered by these English names. When you add one, also add its
// display name to every file in locales/ (the type check lists any that are missing).
export const RECIPE_CATEGORIES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Dessert',
  'Snack',
  'Drinks',
  'Appetizer',
  'Side Dish',
  'Soup',
  'Salad',
  'Pasta',
  'Pizza',
  'Fish',
  'Seafood',
  'Chicken',
  'Beef',
  'Pork',
  'Gluten-Free',
  'Vegetarian',
  'Asian',
  'Thai',
  'Mexican',
  'Italian',
  'Mediterranean',
  'Baking',
  'Other'
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
