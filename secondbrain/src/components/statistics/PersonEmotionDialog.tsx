"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiArrowUpRight, FiX } from "react-icons/fi";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type {
  AnalyticsPeriod,
  EntryEmotions,
  MoodKey,
  PersonMetric,
} from "@/lib/diary-analytics";
import { EmotionChips } from "./PersonEmotions";
import { emotions, fullDate } from "./presentation";
import s from "./StatisticsDashboard.module.css";

export default function PersonEmotionDialog({
  person,
  period,
  initialEmotion,
  onClose,
  onOpenEntry,
}: {
  person: PersonMetric;
  period: AnalyticsPeriod;
  initialEmotion: MoodKey;
  onClose: () => void;
  onOpenEntry?: (date: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [emotion, setEmotion] = useState(initialEmotion);
  const [entries, setEntries] = useState<EntryEmotions[]>([]);
  const [cursor, setCursor] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const currentEmotion = emotions.find((item) => item.key === emotion)!;
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (element?.showModal) element.showModal();
    else element?.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    return () => {
      element?.close?.();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      person: person.name,
      period,
      emotion,
    });
    if (cursor) params.set("cursor", cursor);
    void (async () => {
      try {
        const response = await authenticatedFetch(
          `/api/statistics/person-emotions?${params}`,
          { signal: abort.signal },
        );
        if (!response.ok) throw new Error("Unable to load ranking");
        const body = await response.json();
        if (
          !Array.isArray(body.entries) ||
          body.entries.length > 12 ||
          (body.nextCursor !== null && typeof body.nextCursor !== "string")
        )
          throw new Error("Invalid ranking");
        if (active) {
          setEntries((previous) => [
            ...new Map(
              [...(cursor ? previous : []), ...body.entries].map(
                (entry: EntryEmotions) => [entry.date, entry],
              ),
            ).values(),
          ]);
          setNextCursor(body.nextCursor);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      abort.abort();
    };
  }, [person.name, period, emotion, cursor, retry]);
  return createPortal(
    <dialog
      ref={dialog}
      className={s.emotionDialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={s.emotionDialogHeader}>
        <div>
          <span className={s.kicker}>TU DIARIO CON {person.name}</span>
          <h2 id={titleId}>
            Entradas con más{" "}
            {emotion === "neutral"
              ? "neutralidad"
              : currentEmotion.label.toLocaleLowerCase("es")}
          </h2>
        </div>
        <button
          autoFocus
          className={s.closeConnection}
          onClick={onClose}
          aria-label="Cerrar entradas por emoción"
        >
          <FiX />
        </button>
      </div>
      <div className={s.rankingTabs} aria-label="Ordenar entradas por emoción">
        {emotions.map((item) => (
          <button
            key={item.key}
            aria-pressed={emotion === item.key}
            disabled={!person.emotions?.sampleCounts[item.key]}
            style={{ "--emotion-color": item.color } as React.CSSProperties}
            onClick={() => {
              if (item.key === emotion) return;
              setEmotion(item.key);
              setCursor("");
              setNextCursor(null);
              setEntries([]);
            }}
          >
            <i />
            {item.label}
          </button>
        ))}
      </div>
      <p className={s.rankingDescription}>
        De mayor a menor puntuación en el periodo elegido. Cada entrada conserva
        sus emociones guardadas. Las puntuaciones ausentes no cuentan como cero.
      </p>
      <div className={s.rankedEntries} aria-busy={loading}>
        {entries.map((entry, index) => (
          <button
            key={entry.date}
            className={s.rankedEntry}
            disabled={!onOpenEntry}
            aria-label={`Abrir entrada con ${person.name} del ${fullDate(entry.date)}`}
            onClick={() => {
              onClose();
              onOpenEntry?.(entry.date);
            }}
          >
            <span className={s.entryRank}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={s.rankedEntryBody}>
              <span className={s.memoryDate}>
                {fullDate(entry.date)}
                <FiArrowUpRight />
              </span>
              <EmotionChips values={entry} />
            </span>
            <strong style={{ color: currentEmotion.color }}>
              {entry[emotion]}
              <small>/100</small>
            </strong>
          </button>
        ))}
        {loading && (
          <p role="status" className={s.rankingStatus}>
            Cargando entradas…
          </p>
        )}
        {error && (
          <div role="alert" className={s.rankingStatus}>
            <p>No se pudieron cargar las entradas.</p>
            <button
              className={s.textButton}
              onClick={() => setRetry((value) => value + 1)}
            >
              Reintentar entradas
            </button>
          </div>
        )}
        {!loading && !error && !entries.length && (
          <p className={s.rankingStatus}>
            {nextCursor
              ? "Todavía no hay coincidencias en este grupo de fechas. Puedes seguir buscando."
              : "No hay entradas con esta emoción analizada en el periodo."}
          </p>
        )}
      </div>
      <div className={s.emotionDialogFooter}>
        <span>
          {entries.length} de {person.emotions?.sampleCounts[emotion] || 0}{" "}
          entradas mostradas
        </span>
        {nextCursor && !error && (
          <button
            className={s.textButton}
            disabled={loading}
            onClick={() => setCursor(nextCursor)}
          >
            {entries.length ? "Cargar más entradas" : "Seguir buscando"}
          </button>
        )}
      </div>
      <p className={s.personEmotionNote}>
        Estas emociones coinciden con menciones a {person.name}; no explican qué
        las provocó.
      </p>
    </dialog>,
    document.body,
  );
}
