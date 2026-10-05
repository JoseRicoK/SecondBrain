"use client";
import { useState } from "react";
import {
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiShield,
  FiRefreshCw,
} from "react-icons/fi";
import type {
  DashboardPage,
  DashboardUser,
  DashboardUserDetail,
} from "@/lib/dashboard-types";
import { usageLabels } from "@/lib/dashboard-types";
import { useDashboardResource } from "./useDashboardResource";
import DashboardDialog from "./DashboardDialog";
import DiaryReanalysisDialog from "./DiaryReanalysisDialog";
import { date, number, planLabel, statusLabel } from "./DashboardOverview";
import styles from "./dashboard.module.css";
export function ResourceState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return loading ? (
    <p role="status" className={styles.empty}>
      Cargando información…
    </p>
  ) : error ? (
    <div role="alert" className={styles.error}>
      <p>{error}</p>
      <button onClick={onRetry}>Reintentar</button>
    </div>
  ) : null;
}
export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className={styles.pagination}>
      <span>
        {number(total)} resultados · Página {page} de {pages}
      </span>
      <div>
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
        >
          <FiChevronLeft />
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Página siguiente"
        >
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}
function UserDetail({
  id,
  revision,
  onDenied,
  onClose,
}: {
  id: string;
  revision: number;
  onDenied: () => void;
  onClose: () => void;
}) {
  const [retry, setRetry] = useState(0);
  const { data, loading, error } = useDashboardResource<DashboardUserDetail>(
    `/api/dashboard/users?id=${encodeURIComponent(id)}`,
    revision + retry,
    onDenied,
  );
  return (
    <DashboardDialog
      title={data?.display_name || "Ficha de usuario"}
      onClose={onClose}
    >
      <ResourceState
        loading={loading}
        error={error}
        onRetry={() => setRetry((value) => value + 1)}
      />
      {data && (
        <>
          <p className={styles.userEmail}>
            {data.email || "Sin correo registrado"}
          </p>
          <div className={styles.tags}>
            <span className={styles.badge}>
              {planLabel(data.effective_plan)}
            </span>
            <span className={styles.badge}>{statusLabel(data.status)}</span>
            {data.admin && <span className={styles.badge}>Administrador</span>}
          </div>
          <h3>Cuenta y suscripción</h3>
          <dl className={styles.facts}>
            <div>
              <dt>Identificador</dt>
              <dd className={styles.identifier}>{data.uid}</dd>
            </div>
            <div>
              <dt>Alta</dt>
              <dd>{date(data.created_at)}</dd>
            </div>
            <div>
              <dt>Último inicio de sesión</dt>
              <dd>{date(data.last_login_at)}</dd>
            </div>
            <div>
              <dt>Email verificado</dt>
              <dd>{data.email_confirmed ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt>Google vinculado en la app</dt>
              <dd>{data.is_google_user ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt>Perfil de app creado</dt>
              <dd>{data.has_profile ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt>Plan registrado</dt>
              <dd>{planLabel(data.plan)}</dd>
            </div>
            <div>
              <dt>Plan con acceso actual</dt>
              <dd>{planLabel(data.effective_plan)}</dd>
            </div>
            <div>
              <dt>Fin de periodo</dt>
              <dd>{date(data.current_period_end)}</dd>
            </div>
            <div>
              <dt>Cancelación programada</dt>
              <dd>{data.cancel_at_period_end ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt>Cliente Stripe</dt>
              <dd className={styles.identifier}>
                {data.stripe_customer_id || "No vinculado"}
              </dd>
            </div>
            <div>
              <dt>Suscripción Stripe</dt>
              <dd className={styles.identifier}>
                {data.stripe_subscription_id || "No vinculada"}
              </dd>
            </div>
          </dl>
          <h3>Actividad en la app</h3>
          <dl className={styles.facts}>
            <div>
              <dt>Entradas</dt>
              <dd>{number(data.entries)}</dd>
            </div>
            <div>
              <dt>Personas guardadas</dt>
              <dd>{number(data.people)}</dd>
            </div>
            <div>
              <dt>Transcripciones</dt>
              <dd>{number(data.transcriptions)}</dd>
            </div>
            <div>
              <dt>Entradas analizadas</dt>
              <dd>{number(data.analysedEntries)}</dd>
            </div>
            <div>
              <dt>Última entrada del diario</dt>
              <dd>{date(data.lastEntry)}</dd>
            </div>
            <div>
              <dt>Última modificación del diario</dt>
              <dd>{date(data.lastActivity)}</dd>
            </div>
            <div>
              <dt>Último informe de IA</dt>
              <dd>{date(data.reportGeneratedAt)}</dd>
            </div>
            <div>
              <dt>Sugerencias y errores enviados</dt>
              <dd>{data.feedback}</dd>
            </div>
          </dl>
          <h3>Consumo de los últimos 6 meses</h3>
          {data.usageHistory.length ? (
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Mes UTC</th>
                    <th>Función</th>
                    <th>Completadas</th>
                    <th>Reservadas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.usageHistory.map((item) => (
                    <tr key={`${item.month}-${item.feature}`}>
                      <td>{date(item.month)}</td>
                      <td>{usageLabels[item.feature] || item.feature}</td>
                      <td>{item.used}</td>
                      <td>{item.reserved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.caption}>
              No hay consumo registrado en este periodo.
            </p>
          )}
          <h3>Últimos eventos de facturación</h3>
          {data.billingEvents.length ? (
            <ul className={styles.events}>
              {data.billingEvents.map((event) => (
                <li key={event.id}>
                  <strong>{event.type}</strong>
                  <span>{date(event.occurred_at)}</span>
                  <code>{event.id}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.caption}>Sin eventos de facturación.</p>
          )}
        </>
      )}
    </DashboardDialog>
  );
}
export default function DashboardUsers({
  revision,
  onDenied,
}: {
  revision: number;
  onDenied: () => void;
}) {
  const [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [plan, setPlan] = useState("all"),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [analysisUser, setAnalysisUser] = useState<DashboardUser | null>(null);
  const params = new URLSearchParams({ q: query, plan, page: String(page) });
  const { data, loading, error } = useDashboardResource<
    DashboardPage<DashboardUser>
  >(`/api/dashboard/users?${params}`, revision + retry, onDenied);
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>DIRECTORIO</span>
          <h2>Usuarios y suscripciones</h2>
        </div>
        <span className={styles.badge}>
          {data ? `${number(data.total)} usuarios` : "Usuarios"}
        </span>
      </div>
      <p className={styles.caption}>
        Correo verificado en Auth, acceso efectivo y consumo del mes UTC. Abre
        una ficha para ver el detalle.
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
            placeholder="Nombre, correo o identificador"
            aria-label="Buscar usuarios"
          />
        </label>
        <label>
          Plan
          <select
            value={plan}
            onChange={(event) => {
              setPlan(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los planes</option>
            <option value="free">Gratis</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
        </label>
        <button className={styles.primaryButton} type="submit">
          Buscar
        </button>
      </form>
      <ResourceState
        loading={loading}
        error={error}
        onRetry={() => setRetry((value) => value + 1)}
      />
      {data && (
        <>
          <div className={styles.userList}>
            {data.items.map((user) => (
              <article key={user.uid} className={styles.userRow}>
                <div className={styles.avatar}>
                  {(user.display_name || user.email || "?")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className={styles.userIdentity}>
                  <h3>
                    {user.display_name || "Sin nombre"}
                    {user.admin && <FiShield aria-label="Administrador" />}
                  </h3>
                  <p>{user.email || "Sin correo"}</p>
                  <small>
                    Alta: {date(user.created_at)} · Última sesión:{" "}
                    {date(user.last_login_at)}
                  </small>
                  {!user.has_profile && (
                    <small className={styles.warning}>
                      Perfil pendiente de crear
                    </small>
                  )}
                </div>
                <div className={styles.userPlan}>
                  <span
                    className={styles.badge}
                    data-plan={user.effective_plan}
                  >
                    {planLabel(user.effective_plan)}
                  </span>
                  <small>{statusLabel(user.status)}</small>
                  {user.plan !== user.effective_plan && (
                    <small>Registrado: {planLabel(user.plan)}</small>
                  )}
                </div>
                <div className={styles.userCounts}>
                  <strong>{user.entries}</strong>
                  <small>entradas</small>
                  <span>{user.people} personas</span>
                </div>
                <div className={styles.userConsumption}>
                  {Object.entries(usageLabels).map(([key, label]) => (
                    <span key={key}>
                      {label}: <strong>{user.usage?.[key] || 0}</strong>
                    </span>
                  ))}
                </div>
                <div className={styles.userActions}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => setSelected(user.uid)}
                    aria-label={`Ver ficha de ${user.display_name || user.email || user.uid}`}
                  >
                    Ver ficha
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={!user.has_profile || !user.entries}
                    onClick={() => setAnalysisUser(user)}
                    aria-label={`Volver a analizar diario de ${user.display_name || user.email || user.uid}`}
                  >
                    <FiRefreshCw /> Reanalizar
                  </button>
                </div>
              </article>
            ))}
          </div>
          {data.items.length === 0 && (
            <p className={styles.empty}>
              No hay usuarios que coincidan con estos filtros.
            </p>
          )}
          <Pagination {...data} onPage={setPage} />
        </>
      )}
      {analysisUser && (
        <DiaryReanalysisDialog
          user={analysisUser}
          onDenied={onDenied}
          onClose={() => setAnalysisUser(null)}
          onUpdated={() => setRetry((value) => value + 1)}
        />
      )}
      {selected && (
        <UserDetail
          id={selected}
          revision={revision}
          onDenied={onDenied}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
