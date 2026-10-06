import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./PersonalChat.module.css";
import { FiSend, FiX, FiUser, FiLoader } from "react-icons/fi";
import { Person } from "@/lib/supabase-operations";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface PersonChatProps {
  person: Person;
  isOpen: boolean;
  onClose: () => void;
}

export const PersonChat: React.FC<PersonChatProps> = ({
  person,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const {
    planLimits,
    monthlyUsage,
    loading: subscriptionLoading,
    checkCanSendPersonChatMessage,
    refreshMonthlyUsage,
  } = useSubscription();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  // Focus en el input después de recordar el elemento que abrió el chat.
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `¿Qué te gustaría recordar sobre ${person.name}?\n\nPodemos explorar vuestros recuerdos y los detalles que has guardado en tu diario.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, person.name, messages.length]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || subscriptionLoading) return;
    if (!monthlyUsage) {
      setError(
        "No se pudo comprobar tu cuota de mensajes. Recarga la página para reintentarlo.",
      );
      return;
    }

    // Verificar límites antes de enviar
    const canSend = await checkCanSendPersonChatMessage();
    if (!canSend) {
      setError(
        `Has alcanzado el límite de ${planLimits.personChatMessages} mensajes de chat con personas para este mes. Actualiza tu plan para enviar más mensajes.`,
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

      const token = await user?.getIdToken();
      const response = await fetch("/api/chat-person", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          person,
          message: userMessage,
          conversationHistory,
          currentDate: spainDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Manejar errores de límite específicamente
        if (response.status === 429 && errorData.code === "LIMIT_EXCEEDED") {
          setError(
            `Has alcanzado el límite de ${planLimits.personChatMessages} mensajes de chat con personas para este mes. Actualiza tu plan para enviar más mensajes.`,
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

      // Añadir respuesta del asistente
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Error en chat:", err);
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

  return createPortal(
    <div className={styles.personLayer}>
      <div className={styles.backdrop} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.chatContainer}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key !== "Tab") return;
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
      >
        <header className={styles.chatHeader}>
          <div className={styles.identity}>
            <span className={styles.chatIcon}>
              <FiUser size={22} />
            </span>
            <div>
              <h2 id={titleId}>Chat con {person.name}</h2>
              <p>Recuerdos y detalles de tu diario</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            {monthlyUsage && (
              <span
                className={styles.quota}
                title="Mensajes con personas utilizados este mes"
              >
                {monthlyUsage.personChatMessages} /{" "}
                {planLimits.personChatMessages === -1
                  ? "∞"
                  : planLimits.personChatMessages}
              </span>
            )}
            <button
              onClick={onClose}
              title="Cerrar chat"
              aria-label="Cerrar chat"
            >
              <FiX />
            </button>
          </div>
        </header>
        <div className={styles.messagesArea}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : ""}`}
            >
              {message.role === "assistant" && (
                <span className={styles.messageAvatar}>
                  <FiUser size={15} />
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
                `¿Qué recuerdos comparto con ${person.name}?`,
                `¿Qué sé sobre ${person.name}?`,
                "¿Cómo ha evolucionado nuestra relación?",
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
              <span>Buscando en tus recuerdos…</span>
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
              aria-label="Escribe tu mensaje"
              inputMode="text"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Pregunta sobre ${person.name}…`}
              className={styles.mobileInput}
              autoComplete="off"
              autoCapitalize="sentences"
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
      </section>
    </div>,
    document.body,
  );
};

export default PersonChat;
