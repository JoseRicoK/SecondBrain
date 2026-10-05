"use client";
import { useEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiBookOpen,
  FiLock,
  FiRefreshCw,
  FiShare2,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  diaryToday,
  type AnalyticsPeriod,
  type AnalyticsResponse,
  type SavedReport,
} from "@/lib/diary-analytics";
import StatisticsDashboard from "./statistics/StatisticsDashboard";
import { PREVIEW_ANALYTICS } from "./statistics/preview-data";
import { shareQuote } from "./statistics/share-quote";
import s from "./statistics/StatisticsDashboard.module.css";

export interface StatisticsProps {
  userId: string;
  onOpenEntry?: (date: string) => void;
  onOpenPerson?: (name: string) => void;
}
export default function Statistics(props: StatisticsProps) {
  const { user } = useAuth();
  const subscription = useSubscription();
  if (!user || user.uid !== props.userId) return null;
  if (subscription.loading && !subscription.monthlyUsage)
    return (
      <div className={s.root}>
        <div className={s.skeleton} role="status">
          Comprobando tu plan…
        </div>
      </div>
    );
  if (subscription.error)
    return (
      <div className={s.root}>
        <div className={s.error} role="alert">
          No se pudo comprobar tu plan.
          <button
            className={s.secondary}
            onClick={() => void subscription.refreshMonthlyUsage()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  if (!subscription.planLimits.hasStatistics) return <StatisticsPreview />;
  return (
    <PaidStatistics
      key={`${user.uid}:${subscription.currentPlan}`}
      {...props}
      subscription={subscription}
    />
  );
}
export function StatisticsPreview() {
  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <span className={s.toolbarLabel}>
          <FiLock /> Vista previa · datos de ejemplo
        </span>
      </div>
      <div className={s.preview}>
        <div className={s.previewCanvas} aria-hidden="true" inert>
          <StatisticsDashboard data={PREVIEW_ANALYTICS} preview />
          <div className={s.report}>
            <div>
              <span className={s.kicker}>TU SEMANA EN PERSPECTIVA</span>
              <h2>Una mirada a lo que has vivido</h2>
              <p className={s.reportText}>
                Tiempo compartido, momentos de calma y pequeños logros. Tu
                diario guarda los detalles de tu historia.
              </p>
            </div>
            <div className={s.quote}>
              <blockquote>
                Las pequeñas cosas también cuentan una gran historia.
              </blockquote>
            </div>
          </div>
        </div>
        <div className={s.lockOverlay}>
          <section
            className={s.lockCard}
            aria-labelledby="statistics-upgrade-title"
          >
            <div className={s.lockIcon}>
              <FiLock />
            </div>
            <span className={s.kicker} style={{ justifyContent: "center" }}>
              CONÓCETE UN POCO MÁS
            </span>
            <h2 id="statistics-upgrade-title">
              Tu diario tiene mucho
              <br />
              que contarte.
            </h2>
            <p>
              Descubre tus conexiones, explora cómo te sientes y encuentra tu
              ritmo. Desbloquea tus estadísticas con Pro o Elite.
            </p>
            <div className={s.lockFeatures}>
              <span>
                <FiUsers /> Personas
              </span>
              <span>
                <FiActivity /> Emociones
              </span>
              <span>
                <FiBookOpen /> Hábitos
              </span>
            </div>
            <a href="/subscription" className={s.primary}>
              Mejorar mi plan <FiZap />
            </a>
            <small>Esta es una muestra. No hemos analizado tu diario.</small>
          </section>
        </div>
      </div>
    </div>
  );
}
function PaidStatistics({
  subscription,
  onOpenEntry,
  onOpenPerson,
}: StatisticsProps & { subscription: ReturnType<typeof useSubscription> }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<
    (AnalyticsResponse & { period: AnalyticsPeriod }) | null
  >(null);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const alive = useRef(true);
  const reportBusy = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void (async () => {
      try {
        const response = await authenticatedFetch(
          `/api/statistics/analytics?period=${period}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 403) {
          setDenied(true);
          void subscription.refreshMonthlyUsage();
          return;
        }
        if (!response.ok)
          throw new Error(
            data.error || "No se pudieron cargar las estadísticas",
          );
        setResult({ ...data, period });
        setReport((previous) =>
          previous &&
          (!data.report || previous.generatedAt > data.report.generatedAt)
            ? previous
            : data.report,
        );
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las estadísticas",
          );
      }
    })();
    return () => controller.abort();
    // Subscription quota refreshes don't trigger data reads or report generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, reload]);
  useEffect(() => {
    let lastActivation = 0;
    let day = diaryToday();
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      // Focus and visibility can arrive together; issue only one refresh.
      const now = Date.now();
      if (now - lastActivation < 1000) return;
      lastActivation = now;
      day = diaryToday();
      setReload((value) => value + 1);
    };
    const timer = window.setInterval(() => {
      if (diaryToday() !== day) refresh();
    }, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const maximum = subscription.planLimits.statisticsAccess;
  const remaining =
    maximum === -1
      ? -1
      : Math.max(
          0,
          maximum - (subscription.monthlyUsage?.statisticsAccess ?? maximum),
        );
  async function generateReport() {
    if (reportBusy.current || subscription.loading || remaining === 0) return;
    reportBusy.current = true;
    setBusy(true);
    setReportError("");
    try {
      const response = await authenticatedFetch("/api/statistics/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: true }),
      });
      const data = await response.json();
      if (!alive.current) return;
      if (response.status === 403) {
        setDenied(true);
        void subscription.refreshMonthlyUsage();
        return;
      }
      if (!response.ok)
        throw new Error(data.error || "No se pudo generar el informe");
      setReport({
        weekSummary: data.weekSummary,
        instagramQuote: data.instagramQuote,
        generatedAt: data.generatedAt,
      });
    } catch (e) {
      if (alive.current)
        setReportError(
          e instanceof Error ? e.message : "No se pudo generar el informe",
        );
    } finally {
      if (alive.current) {
        setBusy(false);
        reportBusy.current = false;
        void subscription.refreshMonthlyUsage();
      }
    }
  }
  async function share() {
    if (!report) return;
    try {
      await shareQuote(report.instagramQuote);
    } catch (e) {
      if (
        alive.current &&
        !(e instanceof DOMException && e.name === "AbortError")
      )
        setReportError("No se pudo crear la imagen. Puedes reintentarlo.");
    }
  }
  if (denied) return <StatisticsPreview />;
  const loaded = result?.period === period;
  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <span className={s.toolbarLabel}>
          <FiActivity /> Estadísticas personales · sin consumo de IA
        </span>
        <div className={s.toolbarControls}>
          <select
            aria-label="Periodo de estadísticas"
            className={s.select}
            value={period}
            onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
          >
            <option value="all">Todo mi diario</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="365">Últimos 365 días</option>
          </select>
          <button
            className={s.secondary}
            aria-label="Actualizar gráficas"
            onClick={() => setReload((n) => n + 1)}
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className={s.error}>
          {error}
          <button
            className={s.secondary}
            onClick={() => setReload((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      )}
      {!loaded && !error && (
        <div role="status" className={s.skeleton}>
          <FiRefreshCw className={s.spin} /> Conectando los puntos de tu
          historia…
        </div>
      )}
      {loaded && (
        <StatisticsDashboard
          data={result!.analytics}
          onOpenEntry={onOpenEntry}
          onOpenPerson={onOpenPerson}
        />
      )}
      <section className={s.report}>
        <div>
          <span className={s.kicker}>
            <FiZap /> UNA MIRADA CON IA
          </span>
          <h2>Tu semana en perspectiva</h2>
          <p className={s.reportIntro}>
            Un resumen de los últimos siete días y una cita personal. Las
            gráficas de arriba funcionan independientemente de este informe.
          </p>
          {report ? (
            <p className={s.reportText}>{report.weekSummary}</p>
          ) : (
            <p className={s.reportText}>
              Cuando quieras, dale una nueva perspectiva a lo que has vivido
              esta semana.
            </p>
          )}
          <div className={s.reportAction}>
            <button
              className={s.primary}
              disabled={busy || subscription.loading || remaining === 0}
              onClick={() => void generateReport()}
            >
              {busy ? <FiRefreshCw className={s.spin} /> : <FiZap />}
              {busy
                ? "Generando informe…"
                : report
                  ? "Regenerar informe semanal"
                  : "Generar informe semanal"}
            </button>
            {remaining === 0 && (
              <a href="/subscription" className={s.textButton}>
                Ver planes
              </a>
            )}
          </div>
          <p className={s.reportMeta}>
            {remaining === -1
              ? "Informes ilimitados en tu plan."
              : `${remaining} informes disponibles este mes.`}{" "}
            Cada generación consume 1 informe; abrir estadísticas o cambiar el
            periodo no consume informes.
            {subscription.resetAt && (
              <>
                {" "}
                Renovación:{" "}
                {new Date(subscription.resetAt).toLocaleDateString("es")}.
              </>
            )}
          </p>
          {report?.generatedAt && (
            <p className={s.reportMeta}>
              Último informe:{" "}
              {new Date(report.generatedAt).toLocaleString("es")}. No se
              actualiza automáticamente.
            </p>
          )}
          {reportError && (
            <p role="alert" className={s.error}>
              {reportError}
            </p>
          )}
        </div>
        <div className={s.quote}>
          <FiShare2 />
          {report ? (
            <>
              <blockquote>“{report.instagramQuote}”</blockquote>
              <button className={s.textButton} onClick={() => void share()}>
                Compartir o descargar como imagen <FiShare2 />
              </button>
            </>
          ) : (
            <>
              <blockquote>
                Un recuerdo.
                <br />
                Una nueva perspectiva.
              </blockquote>
              <p>
                Tu cita aparecerá aquí al generar el informe. Podrás guardarla o
                compartirla como una imagen.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
