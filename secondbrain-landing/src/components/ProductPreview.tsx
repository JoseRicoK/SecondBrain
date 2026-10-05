"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Mic,
  MessageCircle,
  BarChart3,
  Brain,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import {
  DiaryArtwork,
  VoiceArtwork,
  ChatArtwork,
  ChartArtwork,
} from "./ProductArtwork";
const views = [
  { id: "diary", label: "Diario", icon: BookOpen },
  { id: "voice", label: "Voz", icon: Mic },
  { id: "chat", label: "Chat IA", icon: MessageCircle },
  { id: "charts", label: "Gráficas", icon: BarChart3 },
] as const;
export default function ProductPreview() {
  const [view, setView] = useState<(typeof views)[number]["id"]>("diary");
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return (
    <div className="product-scene" data-motion={motion ? "on" : "off"}>
      <div className="product-halo" aria-hidden="true" />
      <div className="product-window">
        <div className="window-chrome">
          <div className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>Tu espacio en SecondBrain</span>
          <span className="window-lock">● Privado</span>
        </div>
        <div className="product-topbar">
          <span className="product-brand">
            <Brain size={23} />
            SecondBrain
          </span>
          <span className="demo-user">A</span>
        </div>
        <div
          className="product-switcher"
          role="group"
          aria-label="Explorar la demo de SecondBrain"
        >
          {views.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
        <div className="product-body" key={view}>
          {view === "diary" && (
            <>
              <div className="preview-calendar" aria-hidden="true">
                <div>
                  <ChevronLeft size={13} />
                  <strong>Septiembre</strong>
                  <ChevronRight size={13} />
                </div>
                <div className="calendar-grid">
                  {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                    <b key={`d${i}`}>{d}</b>
                  ))}
                  {Array.from({ length: 35 }, (_, i) =>
                    i < 1 || i > 30 ? (
                      <span key={i} />
                    ) : (
                      <span
                        key={i}
                        className={
                          i === 30
                            ? "selected"
                            : i === 24 || i === 27
                              ? "has-entry"
                              : ""
                        }
                      >
                        {i}
                      </span>
                    ),
                  )}
                </div>
                <p>
                  <span />
                  Tus días, a mano.
                </p>
              </div>
              <DiaryArtwork />
            </>
          )}
          {view === "voice" && (
            <div className="demo-panel">
              <span className="demo-panel-tag">
                <Mic size={14} />
                DIARIO DE VOZ
              </span>
              <h3>A veces, es más fácil contarlo.</h3>
              <VoiceArtwork />
              <div className="transcript">
                <span>
                  <CalendarDays size={14} />
                  Ejemplo de transcripción
                </span>
                <p>
                  “Hoy necesitaba desconectar. El paseo de esta tarde me ha
                  ayudado a ordenar las ideas…”
                </p>
              </div>
              <p className="demo-note">
                Graba en la app y revisa el texto antes de incorporarlo a tu
                entrada.
              </p>
            </div>
          )}
          {view === "chat" && (
            <div className="demo-panel">
              <span className="demo-panel-tag">
                <MessageCircle size={14} />
                CHAT CON TU DIARIO
              </span>
              <h3>Mira tu día desde otro ángulo.</h3>
              <ChatArtwork />
              <p className="demo-note">
                Conversación ilustrativa. La IA puede equivocarse; tú decides
                qué conservar.
              </p>
            </div>
          )}
          {view === "charts" && (
            <div className="demo-panel">
              <span className="demo-panel-tag">
                <BarChart3 size={14} />
                ESTADÍSTICAS
              </span>
              <h3>Un poco de perspectiva.</h3>
              <ChartArtwork />
              <div className="demo-insight">
                <Brain size={22} />
                <p>
                  Vuelve a tus experiencias.
                  <br />
                  <strong>Encuentra tus propios patrones.</strong>
                </p>
              </div>
              <p className="demo-note">
                Ejemplo de gráfica. Informes disponibles en planes con
                estadísticas.
              </p>
            </div>
          )}
        </div>
        <div className="preview-caption">
          <span>Mockup interactivo · datos ficticios</span>
          <button
            type="button"
            className="preview-motion"
            aria-label={motion ? "Pausar animaciones" : "Activar animaciones"}
            onClick={() => setMotion(!motion)}
          >
            {motion ? <Pause size={11} /> : <Play size={11} />}
            {motion ? "Pausar" : "Animar"}
          </button>
          <span>
            Explora las pestañas <ArrowRight size={12} />
          </span>
        </div>
      </div>
      <div className="floating-note float-note-top" aria-hidden="true">
        <span className="floating-icon">
          <Mic size={19} />
        </span>
        <div>
          <strong>Tu voz, en palabras.</strong>
          <span>Recuerda cómo lo viviste.</span>
        </div>
      </div>
      <div className="floating-note float-note-bottom" aria-hidden="true">
        <span className="floating-icon pink">
          <MessageCircle size={19} />
        </span>
        <div>
          <strong>Una nueva perspectiva.</strong>
          <span>Sin perder la tuya.</span>
        </div>
      </div>
    </div>
  );
}
