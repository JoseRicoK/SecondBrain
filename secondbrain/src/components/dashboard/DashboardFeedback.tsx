"use client";
import { useState } from "react";
import { FiSearch, FiMessageSquare, FiAlertTriangle } from "react-icons/fi";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  feedbackStatuses,
  feedbackPriorities,
  feedbackTypes,
  type DashboardPage,
  type FeedbackReport,
  type FeedbackStatus,
  type FeedbackPriority,
} from "@/lib/dashboard-types";
import { useDashboardResource } from "./useDashboardResource";
import { date } from "./DashboardOverview";
import { ResourceState, Pagination } from "./DashboardUsers";
import DashboardDialog from "./DashboardDialog";
import styles from "./dashboard.module.css";
function ReportEditor({
  report,
  onSaved,
  onClose,
  onDenied,
}: {
  report: FeedbackReport;
  onSaved: () => void;
  onClose: () => void;
  onDenied: () => void;
}) {
  const [status, setStatus] = useState<FeedbackStatus>(report.status),
    [priority, setPriority] = useState<FeedbackPriority>(report.priority),
    [notes, setNotes] = useState(report.admin_notes),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  return (
    <DashboardDialog
      title={feedbackTypes[report.type]}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <div className={styles.reportAuthor}>
        <strong>{report.display_name || "Usuario"}</strong>
        <span>{report.email}</span>
        <small>{date(report.created_at)}</small>
      </div>
      <p className={styles.reportMessage}>{report.message}</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          setSaving(true);
          setError("");
          try {
            const response = await authenticatedFetch(
              "/api/dashboard/feedback",
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: report.id,
                  status,
                  priority,
                  notes,
                  version: report.updated_at,
                }),
              },
            );
            const result = await response.json();
            if (!response.ok) {
              if ([401, 403].includes(response.status)) onDenied();
              throw new Error(result.error || "No se pudo guardar");
            }
            onSaved();
          } catch (error) {
            setError(
              error instanceof Error ? error.message : "No se pudo guardar",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className={styles.filters}>
          <label>
            Estado
            <select
              aria-label="Estado"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as FeedbackStatus)
              }
            >
              {Object.entries(feedbackStatuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select
              aria-label="Prioridad"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as FeedbackPriority)
              }
            >
              {Object.entries(feedbackPriorities).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.notes}>
          Notas internas
          <textarea
            aria-label="Notas internas"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={5000}
            rows={5}
            placeholder="Seguimiento, diagnóstico y próximos pasos…"
          />
          <small>
            Solo visibles para administradores. No se envían al usuario.
          </small>
        </label>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Cerrar
          </button>
          <button className={styles.primaryButton} disabled={saving}>
            {saving ? "Guardando…" : "Guardar seguimiento"}
          </button>
        </div>
      </form>
    </DashboardDialog>
  );
}
export default function DashboardFeedback({
  revision,
  onDenied,
  onUpdated,
}: {
  revision: number;
  onDenied: () => void;
  onUpdated: () => void;
}) {
  const [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState<FeedbackReport | null>(null),
    [saved, setSaved] = useState(false);
  const params = new URLSearchParams({
    q: query,
    type,
    status,
    page: String(page),
  });
  const { data, loading, error } = useDashboardResource<
    DashboardPage<FeedbackReport>
  >(`/api/dashboard/feedback?${params}`, revision + retry, onDenied);
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>ESCUCHA A TUS USUARIOS</span>
          <h2>Sugerencias y errores</h2>
        </div>
        <span className={styles.badge}>{data?.total ?? "…"} reportes</span>
      </div>
      <p className={styles.caption}>
        Todos los mensajes enviados desde Configuración, con estado, prioridad y
        seguimiento interno.
      </p>
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
          setPage(1);
        }}
      >
        <label className={styles.search}>
          <FiSearch />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={100}
            aria-label="Buscar reportes"
            placeholder="Mensaje, nombre o correo"
          />
        </label>
        <label>
          Tipo
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            {Object.entries(feedbackTypes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            {Object.entries(feedbackStatuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.primaryButton}>Buscar</button>
      </form>
      {saved && (
        <p role="status" className={styles.success}>
          Seguimiento guardado correctamente.
        </p>
      )}
      <ResourceState
        loading={loading}
        error={error}
        onRetry={() => setRetry((value) => value + 1)}
      />
      {data && (
        <>
          <div className={styles.feedbackList}>
            {data.items.map((report) => (
              <article key={report.id} className={styles.feedbackRow}>
                <div className={styles.feedbackIcon}>
                  {report.type === "problem" ? (
                    <FiAlertTriangle />
                  ) : (
                    <FiMessageSquare />
                  )}
                </div>
                <div className={styles.feedbackContent}>
                  <div className={styles.tags}>
                    <span className={styles.badge}>
                      {feedbackTypes[report.type]}
                    </span>
                    <span className={styles.badge} data-status={report.status}>
                      {feedbackStatuses[report.status]}
                    </span>
                    <span
                      className={styles.badge}
                      data-priority={report.priority}
                    >
                      {feedbackPriorities[report.priority]}
                    </span>
                  </div>
                  <h3>{report.display_name || report.email || "Usuario"}</h3>
                  <small>
                    {report.email} · {date(report.created_at)}
                  </small>
                  <p>{report.message}</p>
                </div>
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    setSaved(false);
                    setSelected(report);
                  }}
                  aria-label={`Revisar ${feedbackTypes[report.type].toLowerCase()} de ${report.display_name || report.email}`}
                >
                  Revisar
                </button>
              </article>
            ))}
          </div>
          {data.items.length === 0 && (
            <p className={styles.empty}>
              No hay reportes que coincidan con estos filtros.
            </p>
          )}
          <Pagination {...data} onPage={setPage} />
        </>
      )}
      {selected && (
        <ReportEditor
          report={selected}
          onDenied={onDenied}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setSaved(true);
            setRetry((value) => value + 1);
            onUpdated();
          }}
        />
      )}
    </section>
  );
}
