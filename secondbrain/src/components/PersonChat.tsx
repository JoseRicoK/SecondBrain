import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiX, FiUser, FiLoader } from 'react-icons/fi';
import { Person } from '@/lib/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PersonChatProps {
  person: Person;
  isOpen: boolean;
  onClose: () => void;
}

export const PersonChat: React.FC<PersonChatProps> = ({ person, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus en el input cuando se abre el chat
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `¡Hola! Soy tu asistente para analizar información sobre ${person.name}. Puedes preguntarme cualquier cosa sobre esta persona basándome en la información que has recopilado. ¿En qué puedo ayudarte?`,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, person.name, messages.length]);

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

      const response = await fetch('/api/chat-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          person,
          message: userMessage,
          conversationHistory
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la respuesta del servidor');
      }

      const data = await response.json();

      // Añadir respuesta del asistente
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Error en chat:', err);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 text-purple-600 p-2 rounded-full">
              <FiUser size={16} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Chat con {person.name}</h3>
              <p className="text-sm text-slate-500">Asistente inteligente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Cerrar chat"
            aria-label="Cerrar chat"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
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
                <span className="text-sm">Escribiendo...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Pregunta algo sobre ${person.name}...`}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              title="Enviar mensaje"
              aria-label="Enviar mensaje"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
            >
              {isLoading ? (
                <FiLoader className="animate-spin" size={16} />
              ) : (
                <FiSend size={16} />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Presiona Enter para enviar • Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
};

export default PersonChat;
