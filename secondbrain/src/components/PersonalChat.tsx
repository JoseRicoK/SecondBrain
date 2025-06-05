import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiSend, FiX, FiLoader, FiMessageCircle, FiMinimize2, FiMaximize2 } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/hooks/useAuth';
import styles from './PersonalChat.module.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PersonalChatProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export const PersonalChat: React.FC<PersonalChatProps> = ({ 
  userId, 
  isOpen, 
  onClose, 
  isMinimized, 
  onToggleMinimize 
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entriesAnalyzed, setEntriesAnalyzed] = useState<number>(0);
  
  // Get user display name from auth - using useCallback to avoid dependency issues
  const getUserDisplayName = useCallback(() => {
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
  }, [user]);

  // Initialize userName with actual user name from the start
  const [userName, setUserName] = useState<string>(() => getUserDisplayName());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Focus en el input cuando se abre el chat
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isMinimized]);

  // Update user name when user changes
  useEffect(() => {
    const displayName = getUserDisplayName();
    setUserName(displayName);
  }, [getUserDisplayName]);

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = userName !== 'Usuario' 
        ? `¡Hola ${userName}! Soy tu asistente personal de SecondBrain.`
        : '¡Hola! Soy tu asistente personal de SecondBrain.';
      
      setMessages([{
        role: 'assistant',
        content: `${welcomeMessage} Estoy aquí para ayudarte a analizar y reflexionar sobre tu vida basándome en todas las entradas que has escrito en tu diario. 

Puedo ayudarte a:
• Identificar patrones y tendencias en tu vida
• Analizar tu crecimiento personal a lo largo del tiempo
• Reflexionar sobre tus relaciones y experiencias
• Descubrir insights sobre tus emociones y comportamientos

¿En qué te gustaría que te ayude hoy?`,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, messages.length, userName]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setError(null);

    // Añadir mensaje del usuario
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Preparar historial de conversación para el contexto
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('/api/personal-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          message: userMessage,
          conversationHistory,
          userName: getUserDisplayName()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la respuesta del servidor');
      }

      const data = await response.json();

      // Actualizar número de entradas analizadas y nombre de usuario
      if (data.entriesAnalyzed !== undefined) {
        setEntriesAnalyzed(data.entriesAnalyzed);
      }
      if (data.userName) {
        setUserName(data.userName);
      }

      // Añadir respuesta del asistente
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Error en chat personal:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      
      // Añadir mensaje de error
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay de fondo para cerrar el chat al hacer clic fuera */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
       {/* Chat centrado en la pantalla */}
      <div className={`fixed z-50 transition-all duration-300 flex flex-col ${styles.chatContainer} ${
        isMinimized
          ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-16' 
          : 'inset-0 md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:h-[32rem] md:max-h-[85vh] h-full w-full'
      } bg-white md:rounded-xl shadow-2xl border border-slate-200`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50 md:rounded-t-xl">
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-1.5 md:p-2 rounded-full">
            <FiMessageCircle size={14} className="md:w-4 md:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-slate-900 text-sm md:text-base truncate">Chat Personal</h3>
            {!isMinimized && (
              <p className="text-xs text-slate-500 truncate">
                {entriesAnalyzed > 0 ? `${entriesAnalyzed} entradas analizadas` : 'Asistente inteligente'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Solo mostrar botón minimizar en desktop */}
          <button
            onClick={onToggleMinimize}
            title={isMinimized ? "Expandir chat" : "Minimizar chat"}
            className="hidden md:block text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-white/50 transition-colors"
          >
            {isMinimized ? <FiMaximize2 size={14} className="md:w-4 md:h-4" /> : <FiMinimize2 size={14} className="md:w-4 md:h-4" />}
          </button>
          <button
            onClick={onClose}
            title="Cerrar chat"
            className="text-slate-400 hover:text-slate-600 p-2 md:p-1 rounded-full hover:bg-white/50 transition-colors"
          >
            <FiX size={20} className="md:w-[18px] md:h-[18px]" />
          </button>
        </div>
      </div>

      {/* Messages - Solo visible cuando no está minimizado */}
      {!isMinimized && (
        <>
          <div className={`flex-1 overflow-y-auto p-3 md:p-4 space-y-4 min-h-0 messages-container ${styles.messagesContainer}`}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[90%] rounded-lg p-3 md:p-4 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-purple-200' : 'text-slate-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-900 rounded-lg p-3 flex items-center space-x-2">
                  <FiLoader className="animate-spin" size={14} />
                  <span className="text-sm">Analizando tu vida...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-3 md:px-4 py-2 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Input - Fijo en la parte inferior para móvil */}
          <div className={`p-3 md:p-4 border-t border-slate-200 bg-white md:rounded-b-xl sticky bottom-0 z-10 ${styles.inputContainer}`}>
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={(e) => {
                  // Scroll suave hacia el input al hacer focus
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 300);
                }}
                placeholder="Pregúntame sobre tu vida, patrones, crecimiento..."
                className={`flex-1 px-3 py-3 md:py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white outline-none text-base transition-colors ${styles.mobileInput}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                title="Enviar mensaje"
                aria-label="Enviar mensaje"
                className="px-3 md:px-4 py-3 md:py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1 flex-shrink-0"
              >
                {isLoading ? (
                  <FiLoader className="animate-spin" size={16} />
                ) : (
                  <FiSend size={16} />
                )}
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-2 hidden md:block">
              Presiona Enter para enviar • Shift+Enter para nueva línea
            </p>
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default PersonalChat;
