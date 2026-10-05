import type { MoodTimelinePoint, MoodValues } from "@/lib/diary-analytics";
import type { moodDistribution } from "@/lib/mood-distribution";
import { timelineEmotions, percentage, timelineDateLabel } from "./presentation";
import s from "./StatisticsDashboard.module.css";

export type EmotionChartPoint = MoodTimelinePoint & {
  distribution: ReturnType<typeof moodDistribution>;
  shares: MoodValues;
};
export default function EmotionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: EmotionChartPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className={s.emotionTooltip}>
      <strong>{timelineDateLabel(point)}</strong>
      {timelineEmotions.map((emotion) => (
        <div key={emotion.key} style={{ color: emotion.color }}>
          <span>
            <i style={{ background: emotion.color }} />
            {emotion.label}
          </span>
          <span>
            <b>{percentage(point.distribution.percentages[emotion.key])}</b>
            <small>
              {point[emotion.key] == null
                ? "Sin datos"
                : `${point[emotion.key]}/100`}
            </small>
          </span>
        </div>
      ))}
      <p>
        {point.distribution.total === 0
          ? "Sin reparto: las puntuaciones disponibles suman 0."
          : point.distribution.partial
            ? `Reparto entre ${point.distribution.known} de 5 emociones evaluadas. Las demás no cuentan como cero.`
            : "Porcentaje relativo · debajo, intensidad original."}
      </p>
    </div>
  );
}
