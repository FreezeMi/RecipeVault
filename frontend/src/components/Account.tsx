import React, { useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

interface AccountProps {
  readonly onSuccess: () => void;
}

export default function Account({ onSuccess }: AccountProps) {
  const { user, logout, checkAuth } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  
  const [dataMessage, setDataMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadAll = async () => {
    try {
      setDataLoading(true);
      setDataMessage(null);
      const recipes = await api.getRecipes();
      const content = JSON.stringify(recipes, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recipe_vault_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDataMessage({ text: `Successfully downloaded ${recipes.length} recipes.`, type: 'success' });
    } catch (err) {
      console.error(err);
      setDataMessage({ text: 'Failed to download recipes.', type: 'error' });
    } finally {
      setDataLoading(false);
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setDataLoading(true);
      setDataMessage(null);
      
      const text = await file.text();
      const recipes = JSON.parse(text);
      
      if (!Array.isArray(recipes)) {
        throw new TypeError('Invalid JSON format: expected an array of recipes.');
      }
      
      const response = await api.uploadRecipes(recipes);
      setDataMessage({ text: `Successfully imported ${response.count} recipes.`, type: 'success' });
    } catch (err: any) {
      console.error(err);
      setDataMessage({ text: err.message || 'Failed to upload recipes.', type: 'error' });
    } finally {
      setDataLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleChangePassword = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      // It's a quick fetch call for change password, ideally would be in api.ts
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setMessage({ text: 'Password changed. Please log in again.', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      
      // Since changing password invalidates session, we need to log out locally
      setTimeout(() => {
        checkAuth();
        onSuccess();
      }, 2000);
      
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onSuccess();
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="bg-white/95 md:bg-white/60 backdrop-blur-none md:backdrop-blur-xl border border-white/40 p-8 rounded-3xl shadow-sm">
        <h2 className="text-2xl font-bold mb-6 text-stone-800">Account</h2>
        
        <div className="mb-8">
          <div className="block text-sm font-medium text-stone-500 mb-1">Email</div>
          <div className="text-stone-900 font-medium">{user.email}</div>
        </div>
      </div>

      <div className="bg-white/95 md:bg-white/60 backdrop-blur-none md:backdrop-blur-xl border border-white/40 p-8 rounded-3xl shadow-sm">
        <h3 className="text-xl font-bold mb-6 text-stone-800">Security</h3>
        
        {message && (
          <div className={`mb-6 p-4 rounded-xl border text-sm ${
            message.type === 'error' 
              ? 'bg-red-50 text-red-600 border-red-100' 
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-stone-600 mb-1.5">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-stone-600 mb-1.5">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={12}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-stone-800 text-white rounded-xl font-medium shadow-sm hover:bg-stone-900 transition-colors disabled:opacity-50"
          >
            {loading ? 'Changing...' : 'Change password'}
          </button>
        </form>
      </div>
      
      <div className="bg-white/95 md:bg-white/60 backdrop-blur-none md:backdrop-blur-xl border border-white/40 p-8 rounded-3xl shadow-sm">
        <h3 className="text-xl font-bold mb-6 text-stone-800">Data Management</h3>
        <p className="text-sm text-stone-500 mb-6">Backup your recipes by downloading them as a JSON file, or restore them by uploading a previous backup.</p>
        
        {dataMessage && (
          <div className={`mb-6 p-4 rounded-xl border text-sm ${
            dataMessage.type === 'error' 
              ? 'bg-red-50 text-red-600 border-red-100' 
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            {dataMessage.text}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={dataLoading}
            className="flex-1 px-6 py-2.5 bg-brand-50 text-brand-600 border border-brand-200 rounded-xl font-medium hover:bg-brand-100 transition-colors disabled:opacity-50"
          >
            {dataLoading ? 'Processing...' : 'Download All Recipes'}
          </button>
          
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={dataLoading}
            className="flex-1 px-6 py-2.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-xl font-medium hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            {dataLoading ? 'Processing...' : 'Upload Recipes (JSON)'}
          </button>
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </div>
      </div>

      <div className="flex justify-center mt-12">
        <button
          type="button"
          onClick={handleLogout}
          className="px-6 py-2.5 bg-stone-200/50 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
