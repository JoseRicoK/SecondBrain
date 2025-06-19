'use client';

import { useEffect } from 'react';

export default function ChunkErrorHandler() {
  useEffect(() => {
    console.log('🛡️ [ChunkErrorHandler] Inicializando manejo global de errores...');

    // Capturar errores no manejados
    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      const message = event.message || '';
      
      console.error('🚨 [ChunkErrorHandler] Error global capturado:', {
        message,
        error,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });

      // Detectar errores específicos de chunks
      if (
        error?.name === 'ChunkLoadError' ||
        message.includes('Loading chunk') ||
        message.includes('chunk') ||
        message.includes('webpack') ||
        message.includes('timeout') ||
        (error?.stack && error.stack.includes('webpack'))
      ) {
        console.log('🔄 [ChunkErrorHandler] Error de chunk detectado, recargando en 1 segundo...');
        
        // Mostrar notificación temporal
        const notification = document.createElement('div');
        notification.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f59e0b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            max-width: 300px;
          ">
            🔄 Recargando aplicación...
          </div>
        `;
        document.body.appendChild(notification);
        
        // Recargar después de un breve delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
        // Prevenir que el error se propague
        event.preventDefault();
        return true;
      }
    };

    // Capturar promesas rechazadas
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      console.error('🚨 [ChunkErrorHandler] Promise rechazada capturada:', error);

      if (
        error?.name === 'ChunkLoadError' ||
        (typeof error === 'string' && (
          error.includes('Loading chunk') ||
          error.includes('chunk') ||
          error.includes('webpack')
        )) ||
        (error?.message && (
          error.message.includes('Loading chunk') ||
          error.message.includes('chunk') ||
          error.message.includes('webpack')
        ))
      ) {
        console.log('🔄 [ChunkErrorHandler] Error de chunk en promise detectado, recargando...');
        
        // Prevenir el comportamiento por defecto
        event.preventDefault();
        
        // Recargar inmediatamente
        setTimeout(() => {
          window.location.reload();
        }, 500);
        
        return true;
      }
    };

    // Agregar listeners
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

    console.log('✅ [ChunkErrorHandler] Listeners de error configurados');

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      console.log('🧹 [ChunkErrorHandler] Cleanup completado');
    };
  }, []);

  return null;
}
