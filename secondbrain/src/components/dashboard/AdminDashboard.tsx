"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  FiShield,
  FiRefreshCw,
  FiArrowLeft,
  FiBarChart2,
  FiUsers,
  FiInbox,
  FiLock,
} from "react-icons/fi";
import { useAuth } from "@/hooks/useAuth";
import type { DashboardOverview as Overview } from "@/lib/dashboard-types";
import { useDashboardResource } from "./useDashboardResource";
import DashboardOverview from "./DashboardOverview";
import DashboardUsers, { ResourceState } from "./DashboardUsers";
import DashboardFeedback from "./DashboardFeedback";
import styles from "./dashboard.module.css";
export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"overview" | "users" | "feedback">("overview"),
    [revision, setRevision] = useState(0),
    [notice, setNotice] = useState(""),
    [denied, setDenied] = useState(false),
    [deniedUid, setDeniedUid] = useState<string | null>(null);
  const uid = user?.uid;
  const onDenied = useCallback(() => {
    setDenied(true);
    setDeniedUid(uid || null);
  }, [uid]);
  const isDenied = denied && deniedUid === (uid || null);
  const { data, loading, error } = useDashboardResource<Overview>(
    uid && !authLoading && !isDenied
      ? `/api/dashboard/overview?account=${encodeURIComponent(uid)}`
      : null,
    revision,
    onDenied,
  );
  if (authLoading)
    return (
      <main className={styles.gate}>
        <p role="status">Comprobando sesión…</p>
      </main>
    );
  if (!user || isDenied)
    return (
      <main className={styles.gate}>
        <div>
          <FiLock />
          <span className={styles.eyebrow}>ACCESO RESTRINGIDO</span>
          <h1>Panel de administración</h1>
          <p>
            {!user
              ? "Inicia sesión con una cuenta de administrador para acceder."
              : "Tu cuenta no tiene permisos de administrador."}
          </p>
          <Link className={styles.primaryButton} href={user ? "/" : "/login"}>
            {user ? "Volver al diario" : "Iniciar sesión"}
          </Link>
        </div>
      </main>
    );
  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <Link href="/" className={styles.back}>
            <FiArrowLeft />
            Volver al diario
          </Link>
          <span className={styles.adminIdentity}>
            <FiShield />
            {user.email}
          </span>
        </div>
        <div className={styles.heroMain}>
          <div>
            <span className={styles.eyebrow}>SECONDBRAIN · ADMINISTRACIÓN</span>
            <h1>Todo bajo control.</h1>
            <p>Usuarios, suscripciones y lo que tu comunidad quiere mejorar.</p>
          </div>
          <button
            className={styles.refresh}
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            <FiRefreshCw className={loading ? styles.spinning : undefined} />
            Actualizar
          </button>
        </div>
        {data && (
          <small className={styles.updated}>
            Actualizado a las{" "}
            {new Intl.DateTimeFormat("es-ES", { timeStyle: "short" }).format(
              new Date(data.generatedAt),
            )}
          </small>
        )}
      </header>
      <div className={styles.content}>
        <ResourceState
          loading={loading}
          error={error}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {notice && (
          <p role="status" className={styles.success}>
            {notice}
          </p>
        )}
        {data && (
          <>
            <nav
              className={styles.tabs}
              aria-label="Secciones de administración"
            >
              {(
                [
                  { id: "overview", label: "Resumen", icon: FiBarChart2 },
                  { id: "users", label: "Usuarios", icon: FiUsers },
                  { id: "feedback", label: "Bandeja", icon: FiInbox },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => setTab(item.id)}
                >
                  <item.icon />
                  {item.label}
                </button>
              ))}
            </nav>
            {tab === "overview" && (
              <DashboardOverview
                data={data}
                onUsers={() => setTab("users")}
                onFeedback={() => setTab("feedback")}
              />
            )}
            {tab === "users" && (
              <DashboardUsers revision={revision} onDenied={onDenied} />
            )}{" "}
            {tab === "feedback" && (
              <DashboardFeedback
                revision={revision}
                onDenied={onDenied}
                onUpdated={() => {
                  setNotice("Seguimiento guardado correctamente.");
                  setRevision((value) => value + 1);
                }}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
