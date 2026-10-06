"use client";

import { personLabel } from "@/lib/diary-analytics";
import { FiArrowUpRight } from "react-icons/fi";
import type { MoodValues, MoodKey, PersonMetric } from "@/lib/diary-analytics";
import { emotions } from "./presentation";
import s from "./StatisticsDashboard.module.css";

export function EmotionChips({ values }: { values: MoodValues }) {
  const known = emotions.filter((emotion) => values[emotion.key] != null);
  return (
    <span className={s.emotionChips}>
      {known.length ? (
        known.map((emotion) => (
          <span
            key={emotion.key}
            style={{ "--emotion-color": emotion.color } as React.CSSProperties}
            title={`${emotion.label}: ${values[emotion.key]}/100`}
          >
            <i />
            {emotion.label} <b>{values[emotion.key]}</b>
          </span>
        ))
      ) : (
        <span className={s.missingEmotion}>Sin analizar</span>
      )}
    </span>
  );
}
export default function PersonEmotions({
  person,
  onSelectEmotion,
  preview = false,
}: {
  person: PersonMetric;
  onSelectEmotion: (emotion: MoodKey) => void;
  preview?: boolean;
}) {
  const data = person.emotions;
  return (
    <section
      className={s.personEmotionSummary}
      aria-label={`Emociones en entradas con ${personLabel(person)}`}
    >
      <h4>Emociones en sus entradas</h4>
      <p className={s.personAnalyzed}>
        {data?.samples || 0} de {person.count} entradas analizadas
      </p>
      <div className={s.personEmotionButtons}>
        {emotions.map((emotion) => (
          <button
            key={emotion.key}
            disabled={preview || !data?.sampleCounts[emotion.key]}
            onClick={() => onSelectEmotion(emotion.key)}
            aria-label={`Ver entradas con ${personLabel(person)} por ${emotion.label}`}
            aria-haspopup="dialog"
            style={{ "--emotion-color": emotion.color } as React.CSSProperties}
          >
            <span>
              <i />
              {emotion.label}
            </span>
            <b>
              {data?.averages[emotion.key] ?? "—"}
              <small>
                {data?.averages[emotion.key] !== null &&
                data?.averages[emotion.key] !== undefined
                  ? "/100"
                  : ""}
              </small>
            </b>
            <FiArrowUpRight />
            <span className={s.compactMoodTrack}>
              <span style={{ width: `${data?.averages[emotion.key] ?? 0}%` }} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
