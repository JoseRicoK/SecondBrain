'use client';

import React, { useState } from 'react';
import { FiLogOut, FiChevronDown } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';

export default function UserHeader() {
  const { user, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setIsDropdownOpen(false);
  };

  const getUserDisplayName = () => {
    // Priorizar display_name, luego name, luego email
    if (user?.user_metadata?.display_name) {
      return user.user_metadata.display_name;
    }
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuario';
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name
      .split(' ')
      .map((word: string) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-3 bg-white rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-50 transition-colors w-full"
      >
        <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {getUserInitials()}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <FiChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown */}
      {isDropdownOpen && (
        <>
          {/* Overlay para cerrar el dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FiLogOut className="w-4 h-4 mr-3" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
