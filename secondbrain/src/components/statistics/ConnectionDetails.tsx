"use client";
import { useEffect, useState, useRef } from "react";
import { FiArrowUpRight, FiLink, FiX } from "react-icons/fi";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type {
  AnalyticsPeriod,
  ConnectionMetric,
  ConnectionEntry,
} from "@/lib/diary-analytics";
import { EmotionChips } from "./PersonEmotions";
import { fullDate } from "./presentation";
import s from "./StatisticsDashboard.module.css";

export default function ConnectionDetails({
  connection,
  period,
  onOpenEntry,
  onClose,
  embedded = false,
}: {
  connection: ConnectionMetric;
  period: AnalyticsPeriod;
  onOpenEntry?: (date: string) => void;
  onClose: () => void;
  embedded?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!embedded)
      panel.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [embedded]);
  const [visibleCount, setVisibleCount] = useState(4);
  const [entries, setEntries] = useState<ConnectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const params = new URLSearchParams({
    source: connection.source,
    target: connection.target,
    period,
    dates: connection.dates.join(","),
  });
  const url = `/api/statistics/connections?${params}`;
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setEntries([]);
    setVisibleCount(4);
    if (embedded) panel.current?.parentElement?.scrollTo?.({ top: 0 });
    void (async () => {
      try {
        const response = await authenticatedFetch(url, {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Unable to read connection");
        const body = await response.json();
        if (!Array.isArray(body.entries) || body.entries.length > 12)
          throw new Error("Invalid connection response");
        if (active) setEntries(body.entries);
      } catch {
        if (active)
          setError(
            "No se pudieron cargar los recuerdos compartidos. Puedes reintentarlo.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      abort.abort();
    };
  }, [url, retry, embedded]);
  return (
    <section
      ref={panel}
      className={s.connectionDetails}
      aria-label={`Recuerdos con ${connection.sourceLabel || connection.source} y ${connection.targetLabel || connection.target}`}
    >
      <div className={s.cardHeading}>
        <div>
          <span className={s.kicker}>
            <FiLink /> EN LAS MISMAS ENTRADAS
          </span>
          <h3>
            {connection.sourceLabel || connection.source} y{" "}
            {connection.targetLabel || connection.target}
          </h3>
        </div>
        <button
          className={s.closeConnection}
          onClick={onClose}
          aria-label="Cerrar recuerdos compartidos"
        >
          <FiX />
        </button>
      </div>
      <p className={s.caption}>
        Aparecen en {connection.count}{" "}
        {connection.count === 1 ? "entrada" : "entradas"} del periodo. Esto no
        implica que estuvieran juntas ni mide su relación.
      </p>
      {loading ? (
        <p role="status">Cargando recuerdos compartidos…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className={s.textButton}
            onClick={() => setRetry((n) => n + 1)}
          >
            Reintentar recuerdos
          </button>
        </div>
      ) : entries.length ? (
        <>
          <div className={s.sharedMemories}>
            {entries.slice(0, visibleCount).map((entry) => (
              <button
                className={s.sharedMemory}
                key={entry.date}
                disabled={!onOpenEntry}
                onClick={() => onOpenEntry?.(entry.date)}
                aria-label={`Abrir recuerdo con ${connection.sourceLabel || connection.source} y ${connection.targetLabel || connection.target} del ${fullDate(entry.date)}`}
              >
                <span className={s.memoryDate}>
                  {fullDate(entry.date)}
                  <FiArrowUpRight />
                </span>
                <span className={s.memoryExcerpt}>{entry.excerpt}</span>
                <EmotionChips values={entry} />
              </button>
            ))}
          </div>
          <div className={s.memoryExpansion}>
            <span aria-live="polite">
              Mostrando {Math.min(visibleCount, entries.length)} de{" "}
              {entries.length} recuerdos
            </span>
            {visibleCount < entries.length && (
              <button
                className={s.textButton}
                onClick={() => setVisibleCount((count) => count + 4)}
              >
                Ver más recuerdos
              </button>
            )}
            {visibleCount > 4 && (
              <button
                className={s.textButton}
                onClick={() => setVisibleCount(4)}
              >
                Mostrar menos recuerdos
              </button>
            )}
          </div>
          <p className={s.footnote}>
            Mostramos el inicio de {Math.min(visibleCount, entries.length)}{" "}
            {Math.min(visibleCount, entries.length) === 1
              ? "entrada"
              : "entradas"}
            .
            {connection.count > 12
              ? " Esta lista incluye las 12 más recientes de la conexión."
              : ""}{" "}
            Abre una fecha para leer el recuerdo completo.
          </p>
        </>
      ) : (
        <p className={s.emotionEmpty}>
          Estas referencias han cambiado. Actualiza las gráficas para ver las
          conexiones actuales.
        </p>
      )}
    </section>
  );
}
