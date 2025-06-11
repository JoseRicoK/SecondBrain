'use client';

import React, { useState } from 'react';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiWifi } from 'react-icons/fi';
import { 
  signInUser, 
  signUpUser, 
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
      setMessage('Correo de verificación reenviado. Revisa tu bandeja de entrada.');
    } catch (error: unknown) {
      console.error('❌ Error al reenviar verificación:', error);
      const authError = error as { message?: string };
      setError(authError.message || 'Error al reenviar verificación');
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
