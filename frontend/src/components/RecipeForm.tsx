import React, { useState, useEffect } from 'react';
import type { Recipe, RecipeFormData, Ingredient } from '../types';
import { api } from '../services/api';
import {ArrowLeftIcon, PlusIcon, XIcon, FloppyDiskIcon} from '@phosphor-icons/react';
import { RECIPE_CATEGORIES } from '../constants';

interface Props {
  recipe?: Recipe;
  onSave: () => void;
  onCancel: () => void;
}

const parseIngredients = (jsonStr: string): Ingredient[] => {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error(e);
  }
  return [{ quantity: '', unit: '', name: '' }];
};

const parseInstructions = (jsonStr: string): string[] => {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error(e);
  }
  return [''];
};

const parseTags = (jsonStr?: string | null): string[] => {
  try {
    const parsed = JSON.parse(jsonStr || '[]');
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.error(e);
  }
  return [];
};

const RecipeForm: React.FC<Props> = ({ recipe, onSave, onCancel }) => {
  const [formData, setFormData] = useState<RecipeFormData>({
    title: '',
    description: '',
    tags: [],
    prepTime: '',
    cookTime: '',
    servings: '',
    imageUrl: '',
    sourceUrl: '',
    ingredients: [{ quantity: '', unit: '', name: '' }],
    instructions: [''],
    notes: '',
    isFavorite: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recipe) {
      setFormData({
        title: recipe.title,
        description: recipe.description || '',
        tags: parseTags(recipe.tags),
        prepTime: recipe.prepTime ?? '',
        cookTime: recipe.cookTime ?? '',
        servings: recipe.servings ?? '',
        imageUrl: recipe.imageUrl || '',
        sourceUrl: recipe.sourceUrl || '',
        ingredients: parseIngredients(recipe.ingredients),
        instructions: parseInstructions(recipe.instructions),
        notes: recipe.notes || '',
        isFavorite: recipe.isFavorite,
      });
    }
  }, [recipe]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const addIngredient = () => {
    setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients, { name: '', quantity: '', unit: '' }] }));
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }));
  };

  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...formData.instructions];
    newInstructions[index] = value;
    setFormData(prev => ({ ...prev, instructions: newInstructions }));
  };

  const addInstruction = () => {
    setFormData(prev => ({ ...prev, instructions: [...prev.instructions, ''] }));
  };

  const removeInstruction = (index: number) => {
    setFormData(prev => ({ ...prev, instructions: prev.instructions.filter((_, i) => i !== index) }));
  };

  const validateFormData = (): { valid: boolean; error?: string; cleanIngredients?: typeof formData.ingredients; cleanInstructions?: typeof formData.instructions } => {
    const prep = formData.prepTime === '' ? null : Number(formData.prepTime);
    const cook = formData.cookTime === '' ? null : Number(formData.cookTime);
    const serv = formData.servings === '' ? null : Number(formData.servings);
    
    if (prep !== null && prep < 0) return { valid: false, error: 'Prep time must be >= 0' };
    if (cook !== null && cook < 0) return { valid: false, error: 'Cook time must be >= 0' };
    if (serv !== null && serv <= 0) return { valid: false, error: 'Servings must be > 0' };

    const cleanIngredients = formData.ingredients.filter(i => i.name.trim() !== '');
    if (cleanIngredients.length === 0) return { valid: false, error: 'At least one ingredient is required' };

    const cleanInstructions = formData.instructions.filter(i => i.trim() !== '');
    if (cleanInstructions.length === 0) return { valid: false, error: 'At least one instruction step is required' };

    return { valid: true, cleanIngredients, cleanInstructions };
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validation = validateFormData();
    if (!validation.valid) {
      setError(validation.error || 'Validation failed');
      setLoading(false);
      return;
    }

    try {
      const payload: RecipeFormData = {
        ...formData,
        prepTime: formData.prepTime === '' ? '' : Number(formData.prepTime),
        cookTime: formData.cookTime === '' ? '' : Number(formData.cookTime),
        servings: formData.servings === '' ? '' : Number(formData.servings),
        ingredients: validation.cleanIngredients!,
        instructions: validation.cleanInstructions!
      };

      if (recipe) {
        await api.updateRecipe(recipe.id, payload);
      } else {
        await api.createRecipe(payload);
      }
      onSave();
    } catch {
      setError('Failed to save recipe. Please check all required fields.');
    } finally {
      setLoading(false);
    }
  };

  const baseInputClass = "px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:border-brand-500 outline-none transition-all placeholder:text-stone-400";
  const inputClass = `w-full ${baseInputClass}`;
  const labelClass = "block text-sm font-bold text-stone-700 mb-1.5 uppercase tracking-wide";

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <button type="button" onClick={onCancel} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors mb-6 font-medium">
        <ArrowLeftIcon /> Cancel
      </button>

      <div className="bg-white/95 p-8 md:p-12 rounded-3xl shadow-xl shadow-black/5 border border-white/60">
        <h2 className="text-3xl font-bold text-stone-900 mb-8">{recipe ? 'Edit Recipe' : 'Add New Recipe'}</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-8 border border-red-200 text-sm font-medium">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>Title <span className="text-red-500">*</span></label>
              <input id="title" type="text" name="title" value={formData.title} onChange={handleChange} className={inputClass} placeholder="e.g. Grandma's Apple Pie" required />
            </div>
            
            <div>
              <label htmlFor="description" className={labelClass}>Description</label>
              <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} placeholder="A short description of this dish..." />
            </div>

            <div>
              <div className={labelClass}>Tags</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {RECIPE_CATEGORIES.map(tag => {
                  const isSelected = formData.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 shadow-sm border
                        ${isSelected 
                          ? 'bg-brand-600 text-white border-brand-600 shadow-md' 
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900'
                        }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="imageUrl" className={labelClass}>Image URL</label>
              <input id="imageUrl" type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} className={inputClass} placeholder="https://example.com/image.jpg" />
            </div>

            <div>
              <label htmlFor="sourceUrl" className={labelClass}>Original Recipe Link</label>
              <input id="sourceUrl" type="url" name="sourceUrl" value={formData.sourceUrl} onChange={handleChange} className={inputClass} placeholder="https://www.daringgourmet.com/..." />
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div>
                <label htmlFor="prepTime" className={labelClass}>Prep (min)</label>
                <input id="prepTime" type="number" name="prepTime" value={formData.prepTime} onChange={handleChange} min="0" className={inputClass} placeholder="15" />
              </div>
              <div>
                <label htmlFor="cookTime" className={labelClass}>Cook (min)</label>
                <input id="cookTime" type="number" name="cookTime" value={formData.cookTime} onChange={handleChange} min="0" className={inputClass} placeholder="45" />
              </div>
              <div>
                <label htmlFor="servings" className={labelClass}>Servings</label>
                <input id="servings" type="number" name="servings" value={formData.servings} onChange={handleChange} min="1" className={inputClass} placeholder="4" />
              </div>
            </div>
          </div>

          <hr className="border-stone-100" />

          <div>
            <div className={`${labelClass} text-lg flex items-center gap-2`}><span className="text-brand-500">1.</span> Ingredients <span className="text-red-500 text-base">*</span></div>
            <div className="space-y-3 mt-4">
              {formData.ingredients.map((ing, index) => {
                const ingredientKey = `${ing.quantity || 'qty'}-${ing.unit || 'unit'}-${ing.name || 'ingredient'}`;

                return (
                  <div key={ingredientKey} className="flex gap-2 items-center group">
                    <input type="text" placeholder="Qty (200)" aria-label="Ingredient quantity" value={ing.quantity} onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)} className={`${baseInputClass} w-20 md:w-24 shrink-0`} />
                    <input type="text" placeholder="Unit (g)" aria-label="Ingredient unit" value={ing.unit} onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)} className={`${baseInputClass} w-20 md:w-24 shrink-0`} />
                    <input type="text" placeholder="Ingredient name (flour)" aria-label="Ingredient name" value={ing.name} onChange={(e) => handleIngredientChange(index, 'name', e.target.value)} className={`${baseInputClass} flex-1 min-w-0`} />
                    <button type="button" onClick={() => removeIngredient(index)} aria-label="Remove ingredient" className="p-2 text-stone-400 hover:text-red-500 transition-colors opacity-50 group-hover:opacity-100 shrink-0">
                      <XIcon size={20} weight="bold" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addIngredient} className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
              <PlusIcon size={16} weight="bold" /> Add ingredient
            </button>
          </div>

          <hr className="border-stone-100" />

          <div>
            <div className={`${labelClass} text-lg flex items-center gap-2`}><span className="text-brand-500">2.</span> Instructions <span className="text-red-500 text-base">*</span></div>
            <div className="space-y-3 mt-4">
              {formData.instructions.map((inst, index) => {
                const instructionKey = `${inst || 'instruction'}-${index + 1}`;

                return (
                  <div key={instructionKey} className="flex gap-3 items-start group">
                    <span className="mt-2.5 font-bold text-stone-400 w-6 text-right shrink-0">{index + 1}.</span>
                    <input type="text" value={inst} aria-label={`Instruction step ${index + 1}`} onChange={(e) => handleInstructionChange(index, e.target.value)} placeholder="Describe this step..." className={`${baseInputClass} flex-1 min-w-0`} />
                    <button type="button" onClick={() => removeInstruction(index)} aria-label="Remove step" className="mt-2.5 p-1 text-stone-400 hover:text-red-500 transition-colors opacity-50 group-hover:opacity-100 shrink-0">
                      <XIcon size={20} weight="bold" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addInstruction} className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
              <PlusIcon size={16} weight="bold" /> Add step
            </button>
          </div>

          <hr className="border-stone-100" />

          <div className="space-y-5">
            <div>
              <label htmlFor="notes" className={labelClass}>Chef's Notes</label>
              <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Any extra tips or tricks..." />
            </div>
            
            <label htmlFor="isFavorite" className="flex items-center gap-3 cursor-pointer group w-fit">
              <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${formData.isFavorite ? 'bg-accent-500 border-accent-500' : 'bg-white border-stone-300 group-hover:border-accent-500'}`}>
                {formData.isFavorite && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="font-medium text-stone-700 select-none">Mark as Favorite</span>
              <input id="isFavorite" type="checkbox" className="sr-only" checked={formData.isFavorite} onChange={(e) => setFormData({...formData, isFavorite: e.target.checked})} />
            </label>
          </div>

          <div className="pt-6 flex justify-end gap-3">
            <button type="button" onClick={onCancel} disabled={loading} className="px-6 py-3 rounded-xl font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 rounded-xl font-bold bg-brand-600 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-500/40 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              <FloppyDiskIcon size={20} weight="bold" />
              {loading ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeForm;
