import { useState } from 'react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import RecipeForm from './components/RecipeForm';
import Login from './components/Login';
import Account from './components/Account';
import { Recipe } from './types';
import {CookingPotIcon, UserIcon, SignInIcon} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './components/AuthContext';

function App() {
  const [view, setView] = useState<'list' | 'detail' | 'form' | 'login' | 'account'>('list');
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>(undefined);
  
  const { authenticated, logout } = useAuth();

  const handleSelectRecipe = (id: number) => {
    setSelectedRecipeId(id);
    setView('detail');
  };

  const handleAddRecipe = () => {
    setEditingRecipe(undefined);
    setView('form');
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setView('form');
  };

  const handleBackToList = () => {
    setSelectedRecipeId(null);
    setEditingRecipe(undefined);
    setView('list');
  };

  const handleSave = () => {
    if (editingRecipe) {
      setView('detail');
    } else {
      setView('list');
    }
  };

  const handleDelete = () => {
    setView('list');
  };

  const handleAuthSuccess = () => {
    setView('list');
  };

  return (
    <div className="min-h-[100dvh] bg-stone-50 text-stone-900 font-sans selection:bg-brand-500/30 selection:text-brand-900 relative z-0 overflow-x-hidden">
      
      {/* Dynamic Background Blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent-500/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 glass border-b border-white/60">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={handleBackToList}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="bg-brand-500 text-white p-2 rounded-xl shadow-lg shadow-brand-500/30 group-hover:bg-brand-600 transition-colors">
              <CookingPotIcon size={24} weight="duotone" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-stone-800 to-stone-500 drop-shadow-sm">
              Recipe Vault
            </h1>
          </motion.div>

          <div className="flex items-center gap-4">
            {authenticated ? (
              <>
                <button type="button"
                  onClick={() => setView('account')}
                  className={`font-medium flex items-center gap-1.5 transition-colors ${view === 'account' ? 'text-brand-600' : 'text-stone-600 hover:text-stone-900'}`}
                >
                  <UserIcon size={18} />
                  <span>Account</span>
                </button>
                <button type="button"
                  onClick={async () => { await logout(); setView('list'); }}
                  className="font-medium text-stone-600 hover:text-stone-900 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <button type="button"
                onClick={() => setView('login')}
                className={`font-medium flex items-center gap-1.5 transition-colors ${view === 'login' ? 'text-brand-600' : 'text-stone-600 hover:text-stone-900'}`}
              >
                <SignInIcon size={18} />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 relative z-10">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <RecipeList 
                onSelect={handleSelectRecipe} 
                onAdd={handleAddRecipe} 
              />
            </motion.div>
          )}
          
          {view === 'detail' && selectedRecipeId && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <RecipeDetail 
                id={selectedRecipeId}
                onBack={handleBackToList}
                onEdit={handleEditRecipe}
                onDelete={handleDelete}
              />
            </motion.div>
          )}
          
          {view === 'form' && authenticated && (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <RecipeForm 
                recipe={editingRecipe}
                onSave={handleSave}
                onCancel={editingRecipe ? () => setView('detail') : handleBackToList}
              />
            </motion.div>
          )}

          {view === 'login' && !authenticated && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Login onSuccess={handleAuthSuccess} />
            </motion.div>
          )}

          {view === 'account' && authenticated && (
            <motion.div
              key="account"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Account onSuccess={handleAuthSuccess} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;

