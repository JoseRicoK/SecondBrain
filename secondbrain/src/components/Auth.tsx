'use client';

import React, { useState } from 'react';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiWifi } from 'react-icons/fi';
import { 
  signInUser, 
  signUpUser, 
  signInWithGoogle,
  resetUserPassword,
  resendEmailVerification,
  type FirebaseUser 
} from '@/lib/firebase-operations';
import { testFirebaseConnection } from '@/lib/firebase-test';
import Image from 'next/image';

interface AuthProps {
  onAuthSuccess: (user: FirebaseUser) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const user = await signInUser(email, password);
      if (user) {
        console.log('✅ Login exitoso:', user.uid);
        onAuthSuccess(user);
      }
    } catch (error: unknown) {
      console.error('❌ Error en login:', error);
      const authError = error as { message?: string };
      setError(authError.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !name) {
      setError('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      await signUpUser(email, password, name);
      setMessage('Registro exitoso. Revisa tu email para verificar la cuenta.');
      setIsLogin(true);
      setEmail('');
      setPassword('');
      setName('');
    } catch (error: unknown) {
      console.error('❌ Error en registro:', error);
      const authError = error as { message?: string };
      setError(authError.message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Ingresa tu email para recuperar la contraseña');
      return;
    }
    try {
      await resetUserPassword(email);
      setMessage('Hemos enviado un email para restablecer tu contraseña.');
    } catch (error: unknown) {
      console.error('❌ Error al enviar recuperación:', error);
      const authError = error as { message?: string };
      setError(authError.message || 'Error al enviar recuperación');
    }
  };

  const handleResendVerification = async () => {
    if (!email || !password) {
      setError('Ingresa tu email y contraseña para reenviar la verificación');
      return;
    }
    try {
      await resendEmailVerification(email, password);
      setMessage('Email de verificación reenviado. Revisa tu bandeja de entrada.');
    } catch (error: unknown) {
      console.error('❌ Error al reenviar verificación:', error);
      const authError = error as { message?: string };
      setError(authError.message || 'Error al reenviar verificación');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const user = await signInWithGoogle();
      if (user) {
        console.log('✅ Login con Google exitoso:', user.uid);
        onAuthSuccess(user);
      }
    } catch (error: unknown) {
      console.error('❌ Error en login con Google:', error);
      const authError = error as { message?: string };
      setError(authError.message || 'Error al iniciar sesión con Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/image/Logo-simple-SecondBrain.png"
            alt="SecondBrain"
            width={60}
            height={60}
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">SecondBrain</h1>
          <p className="text-gray-600 mt-2">
            {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea una cuenta nueva'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleSignUp}>
          <div className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                    placeholder="Tu nombre"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  placeholder="Tu contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium mt-6"
          >
            {isLoading ? 'Procesando...' : isLogin ? 'Iniciar sesión' : 'Registrarse'}
          </button>
        </form>

        {/* Separador OR */}
        <div className="mt-6 flex items-center">
          <div className="flex-1 border-t border-gray-300"></div>
          <div className="px-4 text-sm text-gray-500">o</div>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Botón de Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full mt-4 bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? 'Procesando...' : `${isLogin ? 'Iniciar sesión' : 'Registrarse'} con Google`}
        </button>

        <div className="mt-6 text-center text-sm text-gray-600 space-y-2">
          {isLogin ? (
            <>
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setIsLogin(false)}>
                ¿No tienes cuenta? Regístrate
              </button>
              <div>
                <button type="button" className="text-indigo-600 hover:underline mr-2" onClick={handleResetPassword}>
                  Olvidé mi contraseña
                </button>
                <button type="button" className="text-indigo-600 hover:underline" onClick={handleResendVerification}>
                  Reenviar verificación
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="text-indigo-600 hover:underline" onClick={() => setIsLogin(true)}>
              ¿Ya tienes cuenta? Inicia sesión
            </button>
          )}
          <div className="pt-2">
            <button type="button" onClick={testFirebaseConnection} className="inline-flex items-center text-gray-500 hover:text-gray-700">
              <FiWifi className="mr-1" />Probar conexión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
