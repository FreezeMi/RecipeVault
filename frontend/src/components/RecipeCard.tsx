import React from 'react';
import type { Recipe } from '../types';
import {HeartIcon, ClockIcon, UsersIcon} from '@phosphor-icons/react';
import { motion } from 'motion/react';

interface Props {
  recipe: Recipe;
  onClick: (id: number) => void;
  onFavorite: (e: React.MouseEvent, id: number) => void;
  index?: number;
}

const RecipeCard: React.FC<Props> = ({ recipe, onClick, onFavorite, index = 0 }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative bg-white/95 rounded-2xl overflow-hidden shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-brand-500/20 border border-stone-200 cursor-pointer transition-shadow backdrop-blur-sm"
      onClick={() => onClick(recipe.id)}
    >
      <div className="relative h-48 overflow-hidden bg-stone-100">
        {recipe.imageUrl ? (
          <motion.img 
            src={recipe.imageUrl} 
            alt={recipe.title} 
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-stone-100">
            <span className="text-stone-400 font-medium text-lg">No image</span>
          </div>
        )}
        
        {/* Tags Badge */}
        {recipe.tags && (
          <div className="absolute top-4 left-4 flex gap-1 flex-wrap">
            {(() => {
              try {
                const parsedTags = JSON.parse(recipe.tags);
                if (Array.isArray(parsedTags) && parsedTags.length > 0) {
                  return (
                    <div className="glass px-3 py-1 rounded-full text-xs font-bold text-stone-800 shadow-sm backdrop-blur-md tracking-wide">
                      {parsedTags[0]}
                      {parsedTags.length > 1 && <span className="ml-1 opacity-70">+{parsedTags.length - 1}</span>}
                    </div>
                  );
                }
              } catch (e) { console.error(e); }
              return null;
            })()}
          </div>
        )}

        {/* Favorite Button */}
        <button type="button" 
          className={`absolute top-4 right-4 p-2 rounded-full glass backdrop-blur-md transition-all active:scale-95 shadow-sm
            ${recipe.isFavorite ? 'text-accent-500' : 'text-stone-400 hover:text-stone-600'}`}
          onClick={(e) => onFavorite(e, recipe.id)}
          title={recipe.isFavorite ? "Unfavorite" : "Favorite"}
        >
          <HeartIcon size={20} weight={recipe.isFavorite ? "fill" : "bold"} />
        </button>
      </div>
      
      <div className="p-5">
        <h3 className="text-lg font-bold text-stone-900 mb-2 leading-tight group-hover:text-brand-600 transition-colors">
          {recipe.title}
        </h3>
        
        {recipe.description && (
          <p className="text-stone-500 text-sm line-clamp-2 mb-4 leading-relaxed">
            {recipe.description}
          </p>
        )}
        
        <div className="flex items-center gap-4 text-xs font-medium text-stone-500 pt-4 border-t border-stone-100">
          {(recipe.prepTime !== null || recipe.cookTime !== null) && (
            <div className="flex items-center gap-1.5">
              <ClockIcon size={16} weight="duotone" className="text-brand-500" />
              <span>
                {((recipe.prepTime || 0) + (recipe.cookTime || 0))} min
              </span>
            </div>
          )}
          
          {recipe.servings !== null && (
            <div className="flex items-center gap-1.5">
              <UsersIcon size={16} weight="duotone" className="text-brand-500" />
              <span>{recipe.servings} servings</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RecipeCard;
