"use client";
import { useEffect, useRef, useState } from "react";
import { FiRefreshCw, FiPause, FiPlay } from "react-icons/fi";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type { DashboardUser } from "@/lib/dashboard-types";
import type {
  ReanalysisJob,
  ReanalysisStatus,
} from "@/lib/diary-reanalysis-types";
import DashboardDialog from "./DashboardDialog";
import styles from "./dashboard.module.css";
const issueLabels = {
  provider: "No se pudo completar el análisis. Puedes reintentarlo.",
  invalid: "No se pudo guardar el análisis. Puedes reintentarlo.",
  changed: "La entrada cambió; se ha conservado su versión actual.",
  deleted: "La entrada se eliminó durante el proceso.",
  too_long: "Supera el límite de 50.000 caracteres.",
  canceled: "Proceso cancelado.",
};
export default function DiaryReanalysisDialog({
  user,
  onDenied,
  onClose,
  onUpdated,
}: {
  user: DashboardUser;
  onDenied: () => void;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<ReanalysisStatus | null>(null);
  const [job, setJob] = useState<ReanalysisJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);
  const alive = useRef(false),
    continueRunning = useRef(false),
    inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  async function read(response: Response) {
    const data = await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status)) onDenied();
      throw new Error(data.error || "No se pudo completar la operación.");
    }
    return data;
  }
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    void authenticatedFetch(
      `/api/dashboard/reanalysis?userId=${encodeURIComponent(user.uid)}`,
      { signal: abort.signal },
    )
      .then(read)
      .then((data) => {
        if (alive.current && !abort.signal.aborted) {
          setStatus(data);
          setJob(data.job);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted && alive.current)
          setError("No se pudo cargar el estado del análisis.");
      })
      .finally(() => {
        if (!abort.signal.aborted && alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
      continueRunning.current = false;
      abort.abort();
    };
  }, [user.uid, loadRevision]);
  const post = async (body: Record<string, string>) =>
    read(
      await authenticatedFetch("/api/dashboard/reanalysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  async function run(initial: ReanalysisJob) {
    let current = initial;
    continueRunning.current = true;
    setRunning(true);
    setNotice("");
    try {
      while (
        alive.current &&
        continueRunning.current &&
        current.status === "running"
      ) {
        const result = await post({ action: "process", jobId: current.id });
        if (!alive.current) return;
        const previousFailures = current.failed;
        current = result.job;
        setJob(current);
        if (result.busy) {
          setNotice(
            "Hay una entrada en curso. Vuelve a pulsar Reanudar cuando termine.",
          );
          break;
        }
        if (current.failed > previousFailures) {
          setNotice(
            "Se ha detenido ante un error para evitar más llamadas fallidas. Puedes reintentar las pendientes.",
          );
          break;
        }
      }
      if (alive.current) onUpdated();
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : "No se pudo continuar.",
        );
    } finally {
      continueRunning.current = false;
      inFlight.current = false;
      if (alive.current) {
        setRunning(false);
        setWorking(false);
      }
    }
  }
  async function start(action: "start" | "resume" | "retry") {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setError("");
    try {
      let current = job;
      if (action === "start") {
        requestId.current ||= crypto.randomUUID();
        current = (
          await post({
            action: "start",
            userId: user.uid,
            requestId: requestId.current,
          })
        ).job;
      } else if (action === "retry" && current)
        current = (await post({ action: "retry", jobId: current.id })).job;
      if (!alive.current || !current) return;
      setJob(current);
      await run(current);
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : "No se pudo iniciar.",
        );
    } finally {
      inFlight.current = false;
      if (alive.current) setWorking(false);
    }
  }
  async function cancel() {
    if (!job || inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setError("");
    try {
      const result = await post({ action: "cancel", jobId: job.id });
      if (alive.current) {
        setJob(result.job);
        onUpdated();
      }
    } catch {
      if (alive.current) setError("No se pudo cancelar el proceso.");
    } finally {
      inFlight.current = false;
      if (alive.current) setWorking(false);
    }
  }
  const finished = job ? job.done + job.failed + job.skipped : 0;
  const active = job?.status === "running";
  return (
    <DashboardDialog title="Volver a analizar el diario" onClose={onClose}>
      <div className={styles.reanalysisIntro}>
        <span className={styles.badge}>
          <FiRefreshCw /> Análisis del usuario
        </span>
        <h3>{user.display_name || user.email}</h3>
        <p>{user.email}</p>
      </div>
      <p className={styles.caption}>
        Recalcula felicidad, calma, estrés, tristeza y Neutral en todas las
        entradas guardadas. Las pendientes también extraen personas y sus datos;
        las ya analizadas conservan sus fichas y menciones.
      </p>
      <p className={styles.caption}>
        No crea entradas nuevas ni repite hechos guardados. Tiene coste de IA
        para el proyecto y no descuenta la cuota del usuario.
      </p>
      {loading ? (
        <p role="status">Cargando estado…</p>
      ) : (
        status && (
          <div className={styles.reanalysisCounts}>
            <span>
              <strong>{status.eligible}</strong> entradas con texto
            </span>
            <span>
              <strong>{job?.peoplePending ?? status.peoplePending}</strong>{" "}
              pendientes de análisis completo
            </span>
          </div>
        )
      )}
      {job && (
        <section
          className={styles.reanalysisProgress}
          aria-label="Progreso del análisis"
        >
          <div>
            <strong>
              {job.status === "completed"
                ? "Proceso finalizado"
                : job.status === "canceled"
                  ? "Proceso cancelado"
                  : running
                    ? "Analizando…"
                    : "Proceso pendiente"}
            </strong>
            <span>
              {finished} / {job.total}
            </span>
          </div>
          <progress
            aria-label="Entradas procesadas"
            value={finished}
            max={Math.max(job.total, 1)}
          />
          <div className={styles.reanalysisCounts}>
            <span>{job.done} actualizadas</span>
            <span>{job.pending} pendientes</span>
            <span>{job.failed} con error</span>
            <span>{job.skipped} omitidas</span>
          </div>
          <p className={styles.caption}>
            El progreso queda guardado. Puedes pausar o cerrar y reanudar sin
            repetir las entradas completadas. Una entrada en curso termina antes
            de la pausa.
          </p>
          {!!job.issues.length && (
            <ul className={styles.reanalysisIssues}>
              {job.issues.map((issue, index) => (
                <li key={`${issue.date}-${index}`}>
                  <time>{issue.date}</time> {issueLabels[issue.code]}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {notice && (
        <p role="status" className={styles.caption}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!loading && !status && (
        <button
          className={styles.secondaryButton}
          onClick={() => {
            setLoading(true);
            setError("");
            setLoadRevision((value) => value + 1);
          }}
        >
          Reintentar carga
        </button>
      )}
      <div className={styles.dialogActions}>
        {running ? (
          <button
            className={styles.secondaryButton}
            onClick={() => {
              continueRunning.current = false;
              setNotice(
                "Pausa solicitada. La entrada en curso terminará primero.",
              );
            }}
          >
            <FiPause /> Pausar
          </button>
        ) : active ? (
          <>
            <button
              className={styles.primaryButton}
              disabled={working}
              onClick={() => void start("resume")}
            >
              <FiPlay /> Reanudar
            </button>
            <button
              className={styles.secondaryButton}
              disabled={working}
              onClick={() => void cancel()}
            >
              Cancelar pendientes
            </button>
          </>
        ) : (
          <button
            className={styles.primaryButton}
            disabled={loading || working || !status?.eligible}
            onClick={() => {
              if (job && job.status !== "running") requestId.current = null;
              void start("start");
            }}
          >
            <FiRefreshCw />{" "}
            {job ? "Iniciar nuevo análisis" : "Analizar todas las entradas"}
          </button>
        )}
        {!running && !!job?.failed && job.status !== "canceled" && (
          <button
            className={styles.secondaryButton}
            disabled={working}
            onClick={() => void start("retry")}
          >
            Reintentar fallidas
          </button>
        )}
      </div>
    </DashboardDialog>
  );
}
