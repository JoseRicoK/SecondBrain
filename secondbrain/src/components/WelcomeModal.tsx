'use client';

import { useEffect, useState } from 'react';
import { FaStar, FaHeart, FaTimes } from 'react-icons/fa';
import { markWelcomeComplete } from '@/lib/subscription-operations';
import styles from './WelcomeModal.module.css';

interface WelcomeModalProps {
  userId: string;
  userName: string;
  planName?: 'free' | 'basic' | 'pro' | 'elite';
  onClose: () => void;
}

export default function WelcomeModal({ userId, userName, planName, onClose }: WelcomeModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    // Mostrar modal después de un pequeño delay
    setTimeout(() => {
      setIsVisible(true);
      setConfettiActive(true);
    }, 500);

    // Parar confeti después de 3 segundos
    setTimeout(() => {
      setConfettiActive(false);
    }, 3500);
  }, []);

  const handleClose = async () => {
    try {
      await markWelcomeComplete(userId);
      setIsVisible(false);
      setTimeout(onClose, 300); // Esperar a que termine la animación
    } catch (error) {
      console.error('Error marcando bienvenida como completada:', error);
      // Cerrar de todas formas
      setIsVisible(false);
      setTimeout(onClose, 300);
    }
  };

  return (
    <>
      {/* Confeti CSS */}
      {confettiActive && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={`${styles.confettiParticle} absolute`}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div 
          className={`bg-white rounded-2xl p-8 m-4 max-w-md w-full shadow-2xl transform transition-all duration-300 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-8'
          }`}
        >
          {/* Botón cerrar */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            title="Cerrar modal de bienvenida"
          >
            <FaTimes className="w-5 h-5" />
          </button>

          {/* Contenido del modal */}
          <div className="text-center">
            {/* Icono principal */}
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <FaStar className="w-10 h-10 text-white" />
            </div>

            {/* Título */}
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              {planName && planName !== 'free' ? '¡Bienvenido a SecondBrain Premium! 🎉' : '¡Bienvenido a SecondBrain! 🎉'}
            </h2>

            {/* Mensaje personalizado */}
            <p className="text-gray-600 mb-6 text-lg">
              ¡Hola <span className="font-semibold text-purple-600">{userName}</span>! 
              {planName && planName !== 'free' ? (
                <>¡Gracias por suscribirte al plan <span className="font-semibold text-purple-600">{planName.charAt(0).toUpperCase() + planName.slice(1)}</span>!</>
              ) : (
                'Estamos emocionados de tenerte aquí.'
              )}
            </p>

            {/* Descripción */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center mb-3">
                <FaHeart className="w-6 h-6 text-red-500 mr-2" />
                <span className="text-lg font-semibold text-gray-800">
                  {planName && planName !== 'free' ? 'Tu experiencia premium comienza ahora' : 'Tu segundo cerebro digital'}
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                {planName && planName !== 'free' ? (
                  'Disfruta de todas las funcionalidades premium: transcripciones ilimitadas, chat avanzado, gestión de personas y mucho más.'
                ) : (
                  'Organiza tus pensamientos, haz seguimiento de tus relaciones y chatea con tu IA personal. ¡Tu viaje hacia una vida más organizada comienza ahora!'
                )}
              </p>
            </div>

            {/* Botón de acción */}
            <button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105"
            >
              ¡Comenzar mi experiencia! ✨
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
