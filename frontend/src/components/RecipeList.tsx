import React, { useState, useEffect } from 'react';
import type { Recipe } from '../types';
import RecipeCard from './RecipeCard';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { MagnifyingGlass, Plus, CookingPot } from '@phosphor-icons/react';

import { RECIPE_CATEGORIES } from '../constants';

interface Props {
  onSelect: (id: number) => void;
  onAdd: () => void;
}

const categories = ['All', ...RECIPE_CATEGORIES];

const RecipeList: React.FC<Props> = ({ onSelect, onAdd }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showFavorites, setShowFavorites] = useState(false);

  const fetchRecipes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecipes({
        search: search || undefined,
        category: category !== 'All' ? category : undefined,
        favorite: showFavorites ? 'true' : undefined
      });
      setRecipes(data);
    } catch (err) {
      setError('Unable to load recipes. Please check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecipes();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, category, showFavorites]);

  const handleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const updated = await api.toggleFavorite(id);
      setRecipes(recipes.map(r => r.id === id ? updated : r));
    } catch (err) {
      alert('Failed to toggle favorite');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-900">Your Recipes</h2>
          <p className="text-stone-500 mt-1">Manage and discover your personal culinary vault.</p>
        </div>
        <motion.button 
          onClick={onAdd} 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-full font-semibold shadow-md shadow-brand-500/20 transition-colors"
        >
          <Plus weight="bold" />
          <span>New Recipe</span>
        </motion.button>
      </div>

      <div className="glass !bg-white/90 p-2 rounded-2xl border border-white/60 shadow-sm flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MagnifyingGlass size={20} className="text-stone-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search by title or ingredient..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-stone-50/50 text-stone-900 border-none rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all placeholder:text-stone-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button 
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 shadow-sm border
            ${showFavorites 
              ? 'bg-accent-50 text-accent-600 border-accent-200' 
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900'
            }`}
          onClick={() => setShowFavorites(!showFavorites)}
        >
          Favorites ★
        </button>
        {categories.map(c => (
          <button 
            key={c}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 shadow-sm border
              ${category === c 
                ? 'bg-stone-800 text-white border-stone-800 shadow-md' 
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900'
              }`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-2xl text-center">
          {error}
        </motion.div>
      )}
      
      {loading && !error && (
        <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          >
            <CookingPot size={48} weight="duotone" className="text-brand-500" />
          </motion.div>
          <p className="text-stone-500 font-medium">Simmering recipes...</p>
        </div>
      )}

      {!loading && !error && recipes.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="py-24 px-6 flex flex-col items-center justify-center text-center glass !bg-white/90 border border-white/60 rounded-3xl"
        >
          <div className="bg-brand-50 p-4 rounded-full mb-4 shadow-inner">
            <CookingPot size={48} weight="duotone" className="text-brand-500" />
          </div>
          {search || category !== 'All' || showFavorites ? (
            <>
              <h3 className="text-xl font-bold text-stone-800 mb-2">No recipes found</h3>
              <p className="text-stone-500 mb-6 max-w-md">Try adjusting your search or filters to find what you're looking for.</p>
              <button 
                onClick={() => { setSearch(''); setCategory('All'); setShowFavorites(false); }} 
                className="bg-white border border-stone-200 text-stone-700 px-5 py-2 rounded-full font-medium hover:bg-stone-50 transition-colors shadow-sm"
              >
                Clear all filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-stone-800 mb-2">Your vault is empty</h3>
              <p className="text-stone-500 mb-6 max-w-md">Add your first recipe to get started on your culinary journey.</p>
              <button 
                onClick={onAdd} 
                className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-md shadow-brand-500/20"
              >
                Add First Recipe
              </button>
            </>
          )}
        </motion.div>
      )}

      {!loading && !error && recipes.length > 0 && (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {recipes.map((recipe, index) => (
              <RecipeCard 
                key={recipe.id} 
                recipe={recipe} 
                index={index}
                onClick={onSelect}
                onFavorite={handleFavorite}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export default RecipeList;
