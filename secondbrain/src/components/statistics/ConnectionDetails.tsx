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
}: {
  connection: ConnectionMetric;
  period: AnalyticsPeriod;
  onOpenEntry?: (date: string) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, []);
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
  }, [url, retry]);
  return (
    <section
      ref={panel}
      className={s.connectionDetails}
      aria-label={`Recuerdos con ${connection.source} y ${connection.target}`}
    >
      <div className={s.cardHeading}>
        <div>
          <span className={s.kicker}>
            <FiLink /> EN LAS MISMAS ENTRADAS
          </span>
          <h3>
            {connection.source} y {connection.target}
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
            {entries.map((entry) => (
              <button
                className={s.sharedMemory}
                key={entry.date}
                disabled={!onOpenEntry}
                onClick={() => onOpenEntry?.(entry.date)}
                aria-label={`Abrir recuerdo con ${connection.source} y ${connection.target} del ${fullDate(entry.date)}`}
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
          <p className={s.footnote}>
            Mostramos el inicio de {entries.length}{" "}
            {entries.length === 1 ? "entrada" : "entradas"}
            {connection.count > 12 ? ", las 12 más recientes" : ""}. Abre una
            fecha para leer el recuerdo completo.
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
