import React, { useState, useEffect } from 'react';
import type { Recipe, Ingredient } from '../types';
import { api } from '../services/api';
import { motion } from 'motion/react';
import { Clock, Users, BookOpen, Heart, PencilSimple, Trash, ArrowLeft, Link as LinkIcon } from '@phosphor-icons/react';

interface Props {
  id: number;
  onBack: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: () => void;
}

const RecipeDetail: React.FC<Props> = ({ id, onBack, onEdit, onDelete }) => {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const data = await api.getRecipe(id);
        setRecipe(data);
      } catch (err) {
        setError('Recipe not found or failed to load.');
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this recipe?')) {
      setIsDeleting(true);
      try {
        await api.deleteRecipe(id);
        onDelete();
      } catch (err) {
        alert('Failed to delete recipe');
        setIsDeleting(false);
      }
    }
  };

  const handleFavorite = async () => {
    if (!recipe) return;
    try {
      const updated = await api.toggleFavorite(id);
      setRecipe(updated);
    } catch (err) {
      alert('Failed to toggle favorite');
    }
  };

  if (loading) return (
    <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
        <BookOpen size={48} weight="duotone" className="text-brand-500" />
      </motion.div>
      <p className="text-zinc-500 font-medium">Opening recipe...</p>
    </div>
  );
  
  if (error || !recipe) return (
    <div className="bg-red-50 text-red-600 p-8 rounded-2xl text-center flex flex-col items-center gap-4">
      <p>{error || 'Recipe not found'}</p>
      <button onClick={onBack} className="bg-white px-4 py-2 rounded-full font-medium shadow-sm border border-red-100 hover:bg-red-50">Go Back</button>
    </div>
  );

  let ingredients: Ingredient[] = [];
  try { ingredients = JSON.parse(recipe.ingredients); } catch (e) {}

  let instructions: string[] = [];
  try { instructions = JSON.parse(recipe.instructions); } catch (e) {}

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={onBack} 
        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors mb-6 font-medium group"
      >
        <ArrowLeft className="group-hover:-translate-x-1 transition-transform" />
        Back to recipes
      </button>
      
      <div className="bg-white/95 rounded-3xl overflow-hidden shadow-lg shadow-black/5 border border-stone-200 backdrop-blur-sm">
        
        {/* Header Section */}
        <div className="relative">
          {recipe.imageUrl ? (
            <div className="w-full h-[40dvh] min-h-[300px] relative">
              <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>
          ) : (
            <div className="w-full h-32 bg-gradient-to-r from-brand-500 to-brand-600" />
          )}

          <div className={`p-8 md:p-10 ${recipe.imageUrl ? 'absolute bottom-0 left-0 w-full text-white' : 'pb-6'}`}>
            <div className="flex justify-between items-start gap-4">
              <div>
                {recipe.category && (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${recipe.imageUrl ? 'bg-white/20 backdrop-blur-md text-white' : 'bg-brand-50 text-brand-600'}`}>
                    {recipe.category}
                  </span>
                )}
                <h1 className={`text-3xl md:text-5xl font-bold tracking-tight mb-2 leading-tight ${recipe.imageUrl ? 'text-white' : 'text-stone-900'}`}>
                  {recipe.title}
                </h1>
                {recipe.description && (
                  <p className={`text-lg max-w-2xl ${recipe.imageUrl ? 'text-white/90' : 'text-stone-500'}`}>
                    {recipe.description}
                  </p>
                )}
              </div>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-3 rounded-full shrink-0 shadow-lg ${recipe.imageUrl ? 'bg-white/20 backdrop-blur-md border border-white/20' : 'bg-white border border-stone-200'}`}
                onClick={handleFavorite}
              >
                <Heart size={28} weight={recipe.isFavorite ? "fill" : "bold"} className={recipe.isFavorite ? 'text-accent-500' : (recipe.imageUrl ? 'text-white' : 'text-stone-400')} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex border-b border-stone-100 bg-stone-50/50 p-4 px-8 items-center justify-between">
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-stone-500">
              <Clock size={20} className="text-brand-500" />
              <div>
                <div className="text-xs text-stone-400 font-medium uppercase tracking-wider">Total Time</div>
                <div className="font-semibold text-stone-900">{((recipe.prepTime || 0) + (recipe.cookTime || 0)) > 0 ? `${(recipe.prepTime || 0) + (recipe.cookTime || 0)} min` : '-'}</div>
              </div>
            </div>
            <div className="w-px h-8 bg-stone-200" />
            <div className="flex items-center gap-2 text-stone-500">
              <Users size={20} className="text-brand-500" />
              <div>
                <div className="text-xs text-stone-400 font-medium uppercase tracking-wider">Yield</div>
                <div className="font-semibold text-stone-900">{recipe.servings ? `${recipe.servings} servings` : '-'}</div>
              </div>
            </div>
            {recipe.sourceUrl && (
              <>
                <div className="w-px h-8 bg-stone-200 hidden sm:block" />
                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-2 text-brand-600 hover:text-brand-700 transition-colors">
                  <div className="bg-brand-50 p-2 rounded-lg"><LinkIcon size={18} weight="bold" /></div>
                  <span className="font-semibold text-sm">Original Recipe</span>
                </a>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => onEdit(recipe)} className="p-2 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
              <PencilSimple size={20} />
            </button>
            <button onClick={handleDelete} disabled={isDeleting} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-12 gap-12">
          
          <div className="md:col-span-4">
            <h2 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm border border-brand-100">1</span>
              Ingredients
            </h2>
            <ul className="space-y-4">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex gap-3 text-stone-600 py-2 border-b border-stone-100 last:border-0">
                  <span className="font-semibold text-stone-900 min-w-[3rem]">{ing.quantity} {ing.unit}</span>
                  <span>{ing.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-8">
            <h2 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm border border-brand-100">2</span>
              Instructions
            </h2>
            <div className="space-y-6">
              {instructions.map((inst, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="shrink-0 w-8 h-8 rounded-full border-2 border-stone-200 text-stone-400 flex items-center justify-center font-bold text-sm group-hover:border-brand-500 group-hover:text-brand-600 transition-colors">
                    {i + 1}
                  </div>
                  <p className="text-stone-700 leading-relaxed pt-1">
                    {inst}
                  </p>
                </div>
              ))}
            </div>

            {recipe.notes && (
              <div className="mt-12 bg-amber-50 border border-amber-200/50 rounded-2xl p-6">
                <h3 className="font-bold text-amber-900 mb-2 text-sm uppercase tracking-wider">Chef's Notes</h3>
                <p className="text-amber-800 leading-relaxed">{recipe.notes}</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default RecipeDetail;
