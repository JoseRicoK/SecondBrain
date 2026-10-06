import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import {
  FiSend,
  FiX,
  FiLoader,
  FiMessageCircle,
  FiMinimize2,
  FiMaximize2,
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import styles from "./PersonalChat.module.css";

interface ChatMessage {
  role: "user" | "assistant";
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
  onToggleMinimize,
}) => {
  const { user } = useAuth();
  const {
    planLimits,
    monthlyUsage,
    loading: subscriptionLoading,
    checkCanSendPersonalChatMessage,
    refreshMonthlyUsage,
  } = useSubscription();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entriesAnalyzed, setEntriesAnalyzed] = useState<number>(0);

  // Get user display name from auth - using useCallback to avoid dependency issues
  const getUserDisplayName = useCallback(() => {
    // Para Supabase Auth
    if (user?.displayName) {
      return user.displayName;
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return "Usuario";
  }, [user]);

  // Initialize userName with actual user name from the start
  const [userName, setUserName] = useState<string>(() => getUserDisplayName());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  // Focus en el input cuando se abre el chat
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, isMinimized]);

  // Debug simplificado para móvil
  useEffect(() => {
    if (isOpen && !isMinimized) {
      console.log("📱 Chat abierto - Viewport:", {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
      });
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
      const welcomeMessage =
        userName !== "Usuario"
          ? `¡Hola ${userName}! Soy tu asistente personal de LumaDiary.`
          : "¡Hola! Soy tu asistente personal de LumaDiary.";

      setMessages([
        {
          role: "assistant",
          content: `${welcomeMessage}

¿Qué te gustaría explorar hoy? Podemos hablar de tus recuerdos, tus emociones o las personas de tu historia.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, userName]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || subscriptionLoading) return;
    if (!monthlyUsage) {
      setError(
        "No se pudo comprobar tu cuota de mensajes. Recarga la página para reintentarlo.",
      );
      return;
    }

    // Verificar límites antes de enviar
    const canSend = await checkCanSendPersonalChatMessage();
    if (!canSend) {
      setError(
        `Has alcanzado el límite de ${planLimits.personalChatMessages} mensajes de chat personal para este mes. Actualiza tu plan para enviar más mensajes.`,
      );
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setError(null);

    // Añadir mensaje del usuario
    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Preparar historial de conversación para el contexto
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Obtener la fecha actual en horario de España
      const now = new Date();
      const spainDate = new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "long",
      }).format(now);

      // Obtener token de Supabase
      const token = await user?.getIdToken();
      const response = await fetch("/api/personal-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          userId,
          message: userMessage,
          conversationHistory,
          userName: getUserDisplayName(),
          currentDate: spainDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Manejar errores de límite específicamente
        if (response.status === 429 && errorData.code === "LIMIT_EXCEEDED") {
          setError(
            `Has alcanzado el límite de ${planLimits.personalChatMessages} mensajes de chat personal para este mes. Actualiza tu plan para enviar más mensajes.`,
          );
          return;
        }

        throw new Error(
          errorData.error || "Error en la respuesta del servidor",
        );
      }

      const data = await response.json();

      // Refrescar uso mensual después de una respuesta exitosa
      await refreshMonthlyUsage();

      // Actualizar número de entradas analizadas y nombre de usuario
      if (data.entriesAnalyzed !== undefined) {
        setEntriesAnalyzed(data.entriesAnalyzed);
      }
      if (data.userName) {
        setUserName(data.userName);
      }

      // Añadir respuesta del asistente
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Error en chat personal:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");

      // Añadir mensaje de error
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {!isMinimized && <div className={styles.backdrop} onClick={onClose} />}
      <section
        role="dialog"
        aria-modal={!isMinimized}
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key !== "Tab" || isMinimized) return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled)",
            ),
          ].filter((el) => el.getClientRects().length > 0);
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className={`${styles.chatContainer} ${isMinimized ? styles.minimized : ""}`}
      >
        <header className={styles.chatHeader}>
          <div className={styles.identity}>
            <span className={styles.chatIcon}>
              <FiMessageCircle size={22} />
            </span>
            <div>
              <h2 id={titleId}>Chat personal</h2>
              {!isMinimized && (
                <p>
                  {entriesAnalyzed > 0
                    ? `${entriesAnalyzed} entradas analizadas`
                    : "Tu historia, con otra perspectiva"}
                </p>
              )}
            </div>
          </div>
          <div className={styles.headerActions}>
            {!isMinimized && monthlyUsage && (
              <span
                className={styles.quota}
                title="Mensajes utilizados este mes"
              >
                {monthlyUsage.personalChatMessages} /{" "}
                {planLimits.personalChatMessages === -1
                  ? "∞"
                  : planLimits.personalChatMessages}
              </span>
            )}
            <button
              className={styles.minimizeButton}
              onClick={onToggleMinimize}
              title={isMinimized ? "Expandir chat" : "Minimizar chat"}
              aria-label={isMinimized ? "Expandir chat" : "Minimizar chat"}
            >
              {isMinimized ? <FiMaximize2 /> : <FiMinimize2 />}
            </button>
            <button
              onClick={onClose}
              title="Cerrar chat"
              aria-label="Cerrar chat"
            >
              <FiX />
            </button>
          </div>
        </header>
        {!isMinimized && (
          <>
            <div className={styles.messagesArea}>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : ""}`}
                >
                  {message.role === "assistant" && (
                    <span className={styles.messageAvatar}>
                      <FiMessageCircle size={15} />
                    </span>
                  )}
                  <div
                    className={`${styles.messageBody} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}
                  >
                    {message.role === "assistant" ? (
                      <div className="chat-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className={styles.userText}>{message.content}</p>
                    )}
                    <time className={styles.timestamp}>
                      {formatTime(message.timestamp)}
                    </time>
                  </div>
                </div>
              ))}
              {messages.length === 1 && messages[0].role === "assistant" && (
                <div className={styles.suggestions}>
                  {[
                    "¿Qué temas se repiten en mi diario?",
                    "¿Cómo han cambiado mis emociones?",
                    "¿Qué recuerdos comparto con alguien?",
                  ].map((question) => (
                    <button
                      key={question}
                      disabled={subscriptionLoading}
                      onClick={() => {
                        setInputMessage(question);
                        inputRef.current?.focus();
                      }}
                    >
                      {question}
                      <FiSend size={12} />
                    </button>
                  ))}
                </div>
              )}
              {isLoading && (
                <div className={styles.loadingMessage} role="status">
                  <FiLoader className={styles.spinner} size={16} />
                  <span>Buscando en tu historia…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
            {subscriptionLoading && (
              <p role="status" className={styles.quotaLoading}>
                Cargando cuota de mensajes…
              </p>
            )}
            <div className={styles.inputArea}>
              <div className={styles.composer}>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  aria-label="Escribe tu mensaje"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe lo que te gustaría explorar…"
                  className={styles.mobileInput}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck
                  disabled={isLoading || subscriptionLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={
                    !inputMessage.trim() || isLoading || subscriptionLoading
                  }
                  title="Enviar mensaje"
                  aria-label="Enviar mensaje"
                >
                  {isLoading ? (
                    <FiLoader className={styles.spinner} size={19} />
                  ) : (
                    <FiSend size={19} />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
};

export default PersonalChat;
