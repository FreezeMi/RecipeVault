import React, { useState, useEffect } from 'react';
import type { Recipe, RecipeFormData, Ingredient } from '../types';
import { api } from '../services/api';

import { ArrowLeft, Plus, X, FloppyDisk } from '@phosphor-icons/react';
import { RECIPE_CATEGORIES } from '../constants';

interface Props {
  recipe?: Recipe;
  onSave: () => void;
  onCancel: () => void;
}

const categories = RECIPE_CATEGORIES;

const RecipeForm: React.FC<Props> = ({ recipe, onSave, onCancel }) => {
  const [formData, setFormData] = useState<RecipeFormData>({
    title: '',
    description: '',
    category: 'Dinner',
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
      let parsedIngredients: Ingredient[] = [];
      let parsedInstructions: string[] = [];
      
      try {
        parsedIngredients = JSON.parse(recipe.ingredients);
        if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0) {
          parsedIngredients = [{ quantity: '', unit: '', name: '' }];
        }
      } catch (e) {
        parsedIngredients = [{ quantity: '', unit: '', name: '' }];
      }

      try {
        parsedInstructions = JSON.parse(recipe.instructions);
        if (!Array.isArray(parsedInstructions) || parsedInstructions.length === 0) {
          parsedInstructions = [''];
        }
      } catch (e) {
        parsedInstructions = [''];
      }

      setFormData({
        title: recipe.title,
        description: recipe.description || '',
        category: recipe.category || 'Dinner',
        prepTime: recipe.prepTime === null ? '' : recipe.prepTime,
        cookTime: recipe.cookTime === null ? '' : recipe.cookTime,
        servings: recipe.servings === null ? '' : recipe.servings,
        imageUrl: recipe.imageUrl || '',
        sourceUrl: recipe.sourceUrl || '',
        ingredients: parsedIngredients,
        instructions: parsedInstructions,
        notes: recipe.notes || '',
        isFavorite: recipe.isFavorite,
      });
    }
  }, [recipe]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!formData.title.trim()) {
      setError('Title is required');
      setLoading(false);
      return;
    }
    
    const prep = formData.prepTime === '' ? null : Number(formData.prepTime);
    const cook = formData.cookTime === '' ? null : Number(formData.cookTime);
    const serv = formData.servings === '' ? null : Number(formData.servings);
    
    if (prep !== null && prep < 0) { setError('Prep time must be >= 0'); setLoading(false); return; }
    if (cook !== null && cook < 0) { setError('Cook time must be >= 0'); setLoading(false); return; }
    if (serv !== null && serv <= 0) { setError('Servings must be > 0'); setLoading(false); return; }

    const cleanIngredients = formData.ingredients.filter(i => i.name.trim() !== '');
    if (cleanIngredients.length === 0) { setError('At least one ingredient is required'); setLoading(false); return; }

    const cleanInstructions = formData.instructions.filter(i => i.trim() !== '');
    if (cleanInstructions.length === 0) { setError('At least one instruction step is required'); setLoading(false); return; }

    try {
      const payload: RecipeFormData = {
        ...formData,
        prepTime: formData.prepTime === '' ? '' : Number(formData.prepTime),
        cookTime: formData.cookTime === '' ? '' : Number(formData.cookTime),
        servings: formData.servings === '' ? '' : Number(formData.servings),
        ingredients: cleanIngredients,
        instructions: cleanInstructions
      };

      if (recipe) {
        await api.updateRecipe(recipe.id, payload);
      } else {
        await api.createRecipe(payload);
      }
      onSave();
    } catch (err) {
      setError('Failed to save recipe. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-stone-50 border border-stone-200 text-stone-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all placeholder:text-stone-400";
  const labelClass = "block text-sm font-semibold text-stone-700 mb-1.5";

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <button 
        onClick={onCancel} 
        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors mb-6 font-medium group"
      >
        <ArrowLeft className="group-hover:-translate-x-1 transition-transform" />
        Cancel
      </button>

      <div className="bg-white/95 rounded-3xl shadow-lg shadow-black/5 border border-white/50 overflow-hidden p-6 md:p-10 backdrop-blur-sm">
        <h2 className="text-3xl font-bold text-stone-900 mb-8">{recipe ? 'Edit Recipe' : 'Add New Recipe'}</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-8 border border-red-200 text-sm font-medium">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-5">
            <div>
              <label className={labelClass}>Title <span className="text-red-500">*</span></label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} className={inputClass} placeholder="e.g. Grandma's Apple Pie" required />
            </div>
            
            <div>
              <label className={labelClass}>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} placeholder="A short description of this dish..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Category</label>
                <select name="category" value={formData.category} onChange={handleChange} className={inputClass}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Image URL</label>
                <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} className={inputClass} placeholder="https://example.com/image.jpg" />
                <p className="text-xs text-stone-500 mt-1.5">Paste a direct link to an image (e.g. Imgur, Unsplash, or <code className="bg-stone-100 px-1 py-0.5 rounded">https://picsum.photos/800/600</code> for a random placeholder).</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Original Recipe Link</label>
              <input type="url" name="sourceUrl" value={formData.sourceUrl} onChange={handleChange} className={inputClass} placeholder="https://www.daringgourmet.com/..." />
              <p className="text-xs text-stone-500 mt-1.5">Optional link back to the original website where you found this recipe.</p>
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className={labelClass}>Prep (min)</label>
                <input type="number" name="prepTime" value={formData.prepTime} onChange={handleChange} min="0" className={inputClass} placeholder="15" />
              </div>
              <div>
                <label className={labelClass}>Cook (min)</label>
                <input type="number" name="cookTime" value={formData.cookTime} onChange={handleChange} min="0" className={inputClass} placeholder="45" />
              </div>
              <div>
                <label className={labelClass}>Servings</label>
                <input type="number" name="servings" value={formData.servings} onChange={handleChange} min="1" className={inputClass} placeholder="4" />
              </div>
            </div>
          </div>

          <hr className="border-stone-100" />

          <div>
            <label className={`${labelClass} text-lg flex items-center gap-2`}><span className="text-brand-500">1.</span> Ingredients <span className="text-red-500 text-base">*</span></label>
            <div className="space-y-3 mt-4">
              {formData.ingredients.map((ing, index) => (
                <div key={index} className="flex gap-2 items-center group">
                  <input type="text" placeholder="Qty (200)" value={ing.quantity} onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)} className={`${inputClass} w-24`} />
                  <input type="text" placeholder="Unit (g)" value={ing.unit} onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)} className={`${inputClass} w-24`} />
                  <input type="text" placeholder="Ingredient name (flour)" value={ing.name} onChange={(e) => handleIngredientChange(index, 'name', e.target.value)} className={`${inputClass} flex-1`} />
                  <button type="button" onClick={() => removeIngredient(index)} className="p-2 text-stone-400 hover:text-red-500 transition-colors opacity-50 group-hover:opacity-100">
                    <X size={20} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addIngredient} className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
              <Plus size={16} weight="bold" /> Add ingredient
            </button>
          </div>

          <hr className="border-stone-100" />

          <div>
            <label className={`${labelClass} text-lg flex items-center gap-2`}><span className="text-brand-500">2.</span> Instructions <span className="text-red-500 text-base">*</span></label>
            <div className="space-y-3 mt-4">
              {formData.instructions.map((inst, index) => (
                <div key={index} className="flex gap-3 items-start group">
                  <span className="mt-2.5 font-bold text-stone-400 w-6 text-right">{index + 1}.</span>
                  <input type="text" value={inst} onChange={(e) => handleInstructionChange(index, e.target.value)} placeholder="Describe this step..." className={`${inputClass} flex-1`} />
                  <button type="button" onClick={() => removeInstruction(index)} className="mt-2.5 p-1 text-stone-400 hover:text-red-500 transition-colors opacity-50 group-hover:opacity-100">
                    <X size={20} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addInstruction} className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
              <Plus size={16} weight="bold" /> Add step
            </button>
          </div>

          <hr className="border-stone-100" />

          <div className="space-y-5">
            <div>
              <label className={labelClass}>Chef's Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Any extra tips or tricks..." />
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer group w-fit">
              <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${formData.isFavorite ? 'bg-accent-500 border-accent-500' : 'bg-white border-stone-300 group-hover:border-accent-500'}`}>
                {formData.isFavorite && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="font-medium text-stone-700 select-none">Mark as Favorite</span>
              <input type="checkbox" className="sr-only" checked={formData.isFavorite} onChange={(e) => setFormData({...formData, isFavorite: e.target.checked})} />
            </label>
          </div>

          <div className="pt-6 flex justify-end gap-3">
            <button type="button" onClick={onCancel} disabled={loading} className="px-6 py-3 rounded-xl font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 rounded-xl font-bold bg-brand-600 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-500/40 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              <FloppyDisk size={20} weight="bold" />
              {loading ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeForm;
