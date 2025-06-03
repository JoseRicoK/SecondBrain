'use client';

import React, { useState } from 'react';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Image from 'next/image';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isForgotPassword) {
        // Recuperar contraseña
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        setMessage('Te hemos enviado un enlace de recuperación a tu correo electrónico. Revisa tu bandeja de entrada.');
        
        // Volver al login después de 3 segundos
        setTimeout(() => {
          setIsForgotPassword(false);
          setMessage(null);
        }, 3000);
      } else if (isLogin) {
        // Iniciar sesión
        console.log('🔐 Intentando iniciar sesión para:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        if (data.user && data.session) {
          console.log('✅ Login exitoso:', {
            email: data.user.email,
            session_expires: data.session.expires_at
          });
          
          // Verificar que la sesión se guardó correctamente
          setTimeout(async () => {
            const { data: checkSession } = await supabase.auth.getSession();
            if (checkSession.session) {
              console.log('✅ Sesión verificada y guardada correctamente');
            } else {
              console.warn('⚠️ Problema con la persistencia de la sesión');
            }
          }, 100);
          
          onAuthSuccess(data.user);
        }
      } else {
        // Registrarse
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          setMessage('¡Registro exitoso! Revisa tu email para confirmar tu cuenta.');
          // Si el registro es exitoso, cambiar a login
          setTimeout(() => {
            setIsLogin(true);
            setMessage(null);
          }, 3000);
        }
      }
    } catch (error: unknown) {
      console.error('Error de autenticación:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error en la autenticación';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError(null);
    setMessage(null);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    resetForm();
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setIsLogin(false);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/image/Logo-entero-SecondBrain.png"
              alt="SecondBrain"
              width={200}
              height={80}
              priority
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isForgotPassword 
              ? 'Recuperar contraseña' 
              : isLogin 
                ? 'Bienvenido de vuelta' 
                : 'Crea tu cuenta'
            }
          </h1>
          <p className="text-gray-600">
            {isForgotPassword
              ? 'Te enviaremos un enlace para restablecer tu contraseña'
              : isLogin 
                ? 'Accede a tu diario personal inteligente' 
                : 'Únete a SecondBrain y comienza tu viaje'
            }
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleAuth} className="space-y-6">
            {/* Campo de nombre (solo en registro) */}
            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-700">
                  Nombre completo
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    placeholder="Tu nombre completo"
                    required={!isLogin && !isForgotPassword}
                  />
                </div>
              </div>
            )}

            {/* Campo de email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            {/* Campo de contraseña (no en recuperación de contraseña) */}
            {!isForgotPassword && (
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
                {!isLogin && (
                  <p className="text-xs text-gray-500">
                    La contraseña debe tener al menos 6 caracteres
                  </p>
                )}
              </div>
            )}

            {/* Mensajes de error y éxito */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">{message}</p>
              </div>
            )}

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {isForgotPassword 
                    ? 'Enviando enlace...' 
                    : isLogin 
                      ? 'Iniciando sesión...' 
                      : 'Creando cuenta...'
                  }
                </div>
              ) : (
                isForgotPassword 
                  ? 'Enviar enlace de recuperación'
                  : isLogin 
                    ? 'Iniciar sesión' 
                    : 'Crear cuenta'
              )}
            </button>
          </form>

          {/* Enlace de "¿Olvidaste tu contraseña?" solo en modo login */}
          {isLogin && !isForgotPassword && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={toggleForgotPassword}
                className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {/* Navegación entre modos */}
          <div className="mt-6 text-center">
            {isForgotPassword ? (
              <p className="text-gray-600">
                ¿Recordaste tu contraseña?
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setIsLogin(true);
                    resetForm();
                  }}
                  className="ml-1 text-purple-600 hover:text-purple-700 font-medium transition-colors"
                >
                  Volver al login
                </button>
              </p>
            ) : (
              <p className="text-gray-600">
                {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="ml-1 text-purple-600 hover:text-purple-700 font-medium transition-colors"
                >
                  {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Texto adicional */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Al continuar, aceptas nuestros términos de servicio y política de privacidad.
          </p>
        </div>
      </div>
    </div>
  );
}
