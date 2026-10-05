import { Mic, Sparkles, Send, Check, CalendarDays, Users } from "lucide-react";
export function VoiceArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`voice-art ${compact ? "voice-art-compact" : ""}`}
      aria-hidden="true"
    >
      <div className="voice-mic">
        <Mic size={compact ? 23 : 30} />
      </div>
      <div className="voice-wave">
        {[
          12, 24, 38, 20, 46, 62, 34, 52, 72, 44, 26, 58, 36, 18, 32, 48, 24,
          14,
        ].map((height, i) => (
          <span key={i} style={{ height, animationDelay: `${i * 45}ms` }} />
        ))}
      </div>
      <div className="voice-time">
        00:24 <span>Una idea que merece quedarse</span>
      </div>
    </div>
  );
}
export function ChatArtwork({ compact = false }: { compact?: boolean }) {
  const meetings = [
    ["28 de septiembre", "Paseo por el parque después del trabajo."],
    ["24 de septiembre", "Café y una conversación sin prisa."],
    ["20 de septiembre", "Cena en nuestro restaurante de siempre."],
    ["16 de septiembre", "Una vuelta por el centro."],
    ["12 de septiembre", "Tarde de película en casa."],
    ["8 de septiembre", "Desayuno antes de empezar el día."],
    ["3 de septiembre", "Visita a la exposición de fotografía."],
    ["29 de agosto", "Un helado al terminar el paseo."],
    ["25 de agosto", "Comida con amigos."],
    ["21 de agosto", "Tarde en la librería."],
    ["17 de agosto", "Picnic junto al río."],
    ["12 de agosto", "Café para ponernos al día."],
    ["8 de agosto", "Paseo al atardecer."],
    ["4 de agosto", "Cena y juegos de mesa."],
    ["1 de agosto", "Una visita improvisada."],
  ];
  return (
    <div className={`chat-art ${compact ? "chat-art-compact" : ""}`}>
      <div className={compact ? undefined : "chat-history"}>
        <div className="chat-bubble chat-question">
          Dime las veces que he quedado con Laura.
        </div>
        <div className="chat-answer">
          <span className="chat-avatar">
            <Sparkles size={16} />
          </span>
          <div className="chat-bubble">
            <p>
              Has quedado con Laura <strong>15 veces</strong>.
              {!compact &&
                " Estos son los encuentros que aparecen en tu diario:"}
            </p>
            {!compact && (
              <ol className="chat-meetings">
                {meetings.map(([date, description]) => (
                  <li key={date}>
                    <strong>{date}</strong>
                    <span>{description}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="demo-input">
          <span>Pregunta algo sobre tu diario…</span>
          <Send size={16} />
        </div>
      )}
    </div>
  );
}
export function ChartArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chart-art ${compact ? "chart-art-compact" : ""}`}>
      <div className="chart-key">
        <span>
          <i />
          Tranquilidad
        </span>
        <span>
          <i />
          Felicidad
        </span>
      </div>
      <svg
        viewBox="0 0 400 155"
        role="img"
        aria-label="Gráfica ilustrativa de emociones durante una semana; datos ficticios"
      >
        {[30, 65, 100, 135].map((y) => (
          <path
            key={y}
            d={`M0 ${y} H400`}
            stroke="currentColor"
            strokeOpacity=".09"
            fill="none"
          />
        ))}
        <path
          d="M0 115 C35 115 35 62 68 70 S110 117 137 86 S182 83 202 56 S246 95 270 49 S316 61 337 33 S371 46 400 12 L400 155 L0 155 Z"
          fill="#8b5cf6"
          fillOpacity=".10"
        />
        <path
          className="chart-draw"
          d="M0 115 C35 115 35 62 68 70 S110 117 137 86 S182 83 202 56 S246 95 270 49 S316 61 337 33 S371 46 400 12"
          stroke="#8b5cf6"
          strokeWidth="3"
          fill="none"
        />
        <path
          className="chart-draw"
          d="M0 128 C35 130 38 105 68 109 S105 64 137 73 S180 113 202 87 S244 43 270 61 S313 103 337 72 S368 83 400 56"
          stroke="#ec4899"
          strokeWidth="3"
          fill="none"
        />
      </svg>
      <div className="chart-days">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </div>
  );
}
export function DiaryArtwork() {
  return (
    <div className="diary-art">
      <div className="diary-art-date">
        <CalendarDays size={15} /> Miércoles, 30 de septiembre{" "}
        <span>
          <Check size={13} />
          Guardado
        </span>
      </div>
      <h3>Los pequeños momentos también cuentan.</h3>
      <p>
        Hoy he paseado con Ana después del trabajo. Sin prisas, sin mirar el
        móvil. Me ha sentado bien parar un rato.
      </p>
      <p>Quiero guardar más momentos así.</p>
      <div className="diary-art-tags">
        <span>
          <Users size={13} />
          Ana
        </span>
        <span>Un paseo</span>
        <span>Tiempo para mí</span>
      </div>
      <div className="diary-art-prompt">
        <Sparkles size={17} />
        <div>
          <strong>Para seguir reflexionando</strong>
          <span>¿Qué hizo diferente este momento?</span>
        </div>
      </div>
    </div>
  );
}
