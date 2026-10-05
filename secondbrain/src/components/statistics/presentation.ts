import type { MoodKey, MoodTimelinePoint } from "@/lib/diary-analytics";
export const emotions: { key: MoodKey; label: string; color: string }[] = [
  { key: "happiness", label: "Felicidad", color: "#8b6ce0" },
  { key: "tranquility", label: "Calma", color: "#25a699" },
  { key: "stress", label: "Estrés", color: "#ed9b55" },
  { key: "sadness", label: "Tristeza", color: "#609bdf" },
  { key: "neutral", label: "Neutral", color: "#8793a3" },
];
// Visual order from top to bottom. Recharts stacks in the reverse order.
const timelineOrder: MoodKey[] = [
  "happiness",
  "tranquility",
  "neutral",
  "stress",
  "sadness",
];
export const timelineEmotions = timelineOrder.map(
  (key) => emotions.find((emotion) => emotion.key === key)!,
);
export const shortDate = (date: string) =>
  new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export const fullDate = (date: string) =>
  new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export const timelineDateLabel = (
  point: Pick<MoodTimelinePoint, "startDate" | "endDate" | "samples">,
) =>
  point.samples > 1
    ? `${fullDate(point.startDate)} – ${fullDate(point.endDate)} · media de ${point.samples} entradas`
    : fullDate(point.startDate);
export const percentage = (value: number | null) =>
  value == null
    ? "—"
    : `${value.toLocaleString("es", { maximumFractionDigits: 1 })} %`;
