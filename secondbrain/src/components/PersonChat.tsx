import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiX, FiUser, FiLoader } from 'react-icons/fi';
import { Person } from '@/lib/firebase-operations';
import { useSubscription } from '@/hooks/useSubscription';
import { auth } from '@/lib/firebase';

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
  const { 
    planLimits, 
    monthlyUsage, 
    checkCanSendPersonChatMessage,
    refreshMonthlyUsage 
  } = useSubscription();
  
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

    // Verificar límites antes de enviar
    const canSend = await checkCanSendPersonChatMessage();
    if (!canSend) {
      setError(`Has alcanzado el límite de ${planLimits.personChatMessages} mensajes de chat con personas para este mes. Actualiza tu plan para enviar más mensajes.`);
      return;
    }

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

      // Obtener la fecha actual en horario de España
      const now = new Date();
      const spainDate = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      }).format(now);

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/chat-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          person,
          message: userMessage,
          conversationHistory,
          currentDate: spainDate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Manejar errores de límite específicamente
        if (response.status === 429 && errorData.code === 'LIMIT_EXCEEDED') {
          setError(`Has alcanzado el límite de ${planLimits.personChatMessages} mensajes de chat con personas para este mes. Actualiza tu plan para enviar más mensajes.`);
          return;
        }
        
        throw new Error(errorData.error || 'Error en la respuesta del servidor');
      }

      const data = await response.json();

      // Refrescar uso mensual después de una respuesta exitosa
      await refreshMonthlyUsage();

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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
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
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 w-full max-w-2xl h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/30 bg-white/50 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-500/20 text-purple-600 p-2 rounded-full backdrop-blur-sm">
              <FiUser size={16} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Chat con {person.name}</h3>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <span>Asistente inteligente</span>
                {monthlyUsage && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs whitespace-nowrap">
                    {monthlyUsage.personChatMessages}/{planLimits.personChatMessages === -1 ? '∞' : planLimits.personChatMessages}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Cerrar chat"
            aria-label="Cerrar chat"
            className="text-slate-500 hover:text-slate-700 p-1 rounded-full hover:bg-white/50 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-3 backdrop-blur-sm ${
                  message.role === 'user'
                    ? 'bg-purple-500/90 text-white shadow-lg'
                    : 'bg-white/80 text-slate-900 border border-white/30 shadow-sm'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-purple-100' : 'text-slate-500'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/80 text-slate-900 rounded-xl p-3 flex items-center space-x-2 backdrop-blur-sm border border-white/30 shadow-sm">
                <FiLoader className="animate-spin" size={14} />
                <span className="text-sm">Escribiendo...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-100/80 backdrop-blur-sm border-t border-red-200/50">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-white/30 bg-white/50 rounded-b-xl backdrop-blur-sm">
          <div className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Pregunta algo sobre ${person.name}...`}
              className="flex-1 px-3 py-2 border border-white/30 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none text-sm bg-white/80 backdrop-blur-sm shadow-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              title="Enviar mensaje"
              aria-label="Enviar mensaje"
              className="px-4 py-2 bg-purple-500/90 text-white rounded-lg hover:bg-purple-600/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all backdrop-blur-sm shadow-lg flex items-center space-x-1"
            >
              {isLoading ? (
                <FiLoader className="animate-spin" size={16} />
              ) : (
                <FiSend size={16} />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Presiona Enter para enviar • Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
};

export default PersonChat;
