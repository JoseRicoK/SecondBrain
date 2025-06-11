'use client';

import React, { useState } from 'react';
import { FiLogOut, FiChevronDown, FiMail, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { sendEmailVerificationToCurrentUser } from '@/lib/firebase-operations';

export default function UserHeader() {
  const { user, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    setIsDropdownOpen(false);
  };

  const handleSendVerification = async () => {
    setSendingVerification(true);
    setVerificationMessage(null);
    
    try {
      await sendEmailVerificationToCurrentUser();
      setVerificationMessage('Email de verificación enviado. Revisa tu bandeja de entrada.');
    } catch (error) {
      console.error('Error enviando verificación:', error);
      setVerificationMessage('Error al enviar el email. Inténtalo más tarde.');
    } finally {
      setSendingVerification(false);
    }
  };

  const getUserDisplayName = () => {
    // Para Firebase Auth
    if (user?.displayName) {
      return user.displayName;
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
    <>
      {/* Banner de verificación de email */}
      {!user.emailVerified && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiAlertCircle className="text-yellow-400 mr-3" size={20} />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Email no verificado
                </p>
                <p className="text-sm text-yellow-700">
                  Verifica tu email para mayor seguridad de tu cuenta.
                </p>
              </div>
            </div>
            <button
              onClick={handleSendVerification}
              disabled={sendingVerification}
              className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              {sendingVerification ? 'Enviando...' : 'Reenviar email'}
            </button>
          </div>
          {verificationMessage && (
            <p className="text-sm text-yellow-700 mt-2">{verificationMessage}</p>
          )}
        </div>
      )}

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
                {!user.emailVerified && (
                  <p className="text-xs text-yellow-600 mt-1 flex items-center">
                    <FiAlertCircle className="w-3 h-3 mr-1" />
                    Email no verificado
                  </p>
                )}
              </div>
              
              {!user.emailVerified && (
                <button
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                  className="flex items-center w-full px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50 transition-colors"
                >
                  <FiMail className="w-4 h-4 mr-3" />
                  {sendingVerification ? 'Enviando verificación...' : 'Verificar email'}
                </button>
              )}
              
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
    </>
  );
}
