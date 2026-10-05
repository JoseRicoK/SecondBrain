import {
  FiUsers,
  FiMessageSquare,
  FiBookOpen,
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import {
  feedbackStatuses,
  usageLabels,
  type DashboardOverview as Overview,
} from "@/lib/dashboard-types";
import styles from "./dashboard.module.css";
export const number = (value: number) =>
  new Intl.NumberFormat("es-ES").format(value);
export const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeZone: "Europe/Madrid",
      }).format(new Date(value))
    : "—";
export const planLabel = (plan: string) =>
  ({ free: "Gratis", pro: "Pro", elite: "Elite" })[plan] || plan;
export const statusLabel = (status: string) =>
  ({
    active: "Activa",
    inactive: "Inactiva",
    past_due: "Pago pendiente",
    canceled: "Cancelada",
  })[status] || status;
function GrowthChart({
  data,
  field,
}: {
  data: Overview["monthly"];
  field: "users" | "entries";
}) {
  const max = Math.max(1, ...data.map((item) => item[field]));
  return (
    <div
      className={styles.chart}
      aria-label={
        field === "users" ? "Registros mensuales" : "Entradas creadas por mes"
      }
    >
      {data.map((item) => (
        <div key={item.month} className={styles.chartColumn}>
          <strong>{number(item[field])}</strong>
          <div className={styles.chartTrack}>
            <span
              style={{
                height: `${Math.max(item[field] ? 4 : 0, (item[field] / max) * 100)}%`,
              }}
            />
          </div>
          <span>
            {new Intl.DateTimeFormat("es-ES", {
              month: "short",
              timeZone: "UTC",
            }).format(new Date(item.month))}
          </span>
        </div>
      ))}
    </div>
  );
}
export default function DashboardOverview({
  data,
  onUsers,
  onFeedback,
}: {
  data: Overview;
  onUsers: () => void;
  onFeedback: () => void;
}) {
  const open = (data.feedback.open || 0) + (data.feedback.in_progress || 0);
  const metrics = [
    {
      label: "Usuarios registrados",
      value: data.users,
      detail: `${data.newUsers30} nuevos en 30 días`,
      icon: FiUsers,
      click: onUsers,
    },
    {
      label: "Usuarios con actividad",
      value: data.activeUsers30,
      detail: "Han escrito o editado en los últimos 30 días",
      icon: FiActivity,
    },
    {
      label: "Entradas guardadas",
      value: data.entries,
      detail: `${number(data.people)} personas registradas`,
      icon: FiBookOpen,
    },
    {
      label: "Reportes por atender",
      value: open,
      detail: `${data.feedbackTypes.problem || 0} errores · ${data.feedbackTypes.suggestion || 0} sugerencias en total`,
      icon: FiMessageSquare,
      click: onFeedback,
    },
  ];
  return (
    <div className={styles.overview}>
      <div className={styles.metrics}>
        {metrics.map((item) => (
          <article key={item.label} className={styles.metric}>
            <item.icon />
            <p>{item.label}</p>
            <strong>{number(item.value)}</strong>
            <small>{item.detail}</small>
            {item.click && (
              <button onClick={item.click} className={styles.textButton}>
                Ver detalle →
              </button>
            )}
          </article>
        ))}
      </div>
      <div className={styles.twoColumns}>
        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>CRECIMIENTO</span>
              <h2>Nuevos usuarios</h2>
            </div>
            <span className={styles.badge}>Últimos 6 meses</span>
          </div>
          <GrowthChart data={data.monthly} field="users" />
        </section>
        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>ACTIVIDAD</span>
              <h2>Entradas creadas</h2>
            </div>
            <span className={styles.badge}>Últimos 6 meses</span>
          </div>
          <GrowthChart data={data.monthly} field="entries" />
          <p className={styles.caption}>
            Fecha de creación del registro; no la fecha del recuerdo.
          </p>
        </section>
      </div>
      <div className={styles.twoColumns}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>SUSCRIPCIONES</span>
          <h2>Acceso efectivo</h2>
          <p className={styles.caption}>
            Tiene en cuenta el estado y el vencimiento de cada plan.
          </p>
          <div className={styles.planBar}>
            {["free", "pro", "elite"].map((plan) => (
              <span
                key={plan}
                data-plan={plan}
                style={{ flexGrow: data.plans[plan] || 0 }}
                title={`${planLabel(plan)}: ${data.plans[plan] || 0}`}
              />
            ))}
          </div>
          <div className={styles.planLegend}>
            {["free", "pro", "elite"].map((plan) => (
              <div key={plan}>
                <span data-plan={plan} className={styles.dot} />
                {planLabel(plan)}
                <strong>{number(data.plans[plan] || 0)}</strong>
              </div>
            ))}
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Vinculadas a Stripe</dt>
              <dd>{number(data.providerSubscriptions)}</dd>
            </div>
            <div>
              <dt>Cancelación al final del periodo</dt>
              <dd>{number(data.cancellations)}</dd>
            </div>
            {Object.entries(data.subscriptionStates).map(([state, count]) => (
              <div key={state}>
                <dt>{statusLabel(state)}</dt>
                <dd>{number(count)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className={styles.card}>
          <span className={styles.eyebrow}>USO DE IA</span>
          <h2>Consumo del mes</h2>
          <p className={styles.caption}>
            Operaciones completadas · mes UTC de {date(data.usageMonth)}
          </p>
          <div className={styles.usage}>
            {Object.entries(usageLabels).map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <strong>{number(data.usage[key] || 0)}</strong>
              </div>
            ))}
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Grabaciones transcritas</dt>
              <dd>{number(data.transcriptions)}</dd>
            </div>
            <div>
              <dt>Entradas con análisis emocional</dt>
              <dd>{number(data.analysedEntries)}</dd>
            </div>
            <div>
              <dt>Informes de IA guardados</dt>
              <dd>{number(data.reports)}</dd>
            </div>
          </dl>
        </section>
      </div>
      <div className={styles.twoColumns}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>BANDEJA</span>
          <h2>Estado de los reportes</h2>
          <dl className={styles.facts}>
            {Object.entries(feedbackStatuses).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {data.feedback[key as keyof typeof feedbackStatuses] || 0}
                </dd>
              </div>
            ))}
          </dl>
          <button className={styles.primaryButton} onClick={onFeedback}>
            Gestionar sugerencias y errores
          </button>
        </section>
        <section className={styles.card}>
          <span className={styles.eyebrow}>OPERACIÓN</span>
          <h2>Pagos y correo</h2>
          <div className={styles.health}>
            <span>
              {data.checkoutEnabled ? <FiCheckCircle /> : <FiAlertCircle />}
              Pagos reales
            </span>
            <strong>
              {data.checkoutEnabled ? "Habilitados" : "Desactivados"}
            </strong>
          </div>
          <div className={styles.health}>
            <span>Correos de facturación</span>
            <strong>
              {data.billingEmailsEnabled ? "Habilitados" : "Desactivados"}
            </strong>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Correos pendientes</dt>
              <dd>{data.pendingBillingEmails}</dd>
            </div>
            <div>
              <dt>Correos fallidos</dt>
              <dd>{data.failedBillingEmails}</dd>
            </div>
            <div>
              <dt>Eventos de pago en 30 días</dt>
              <dd>{data.billingEvents30}</dd>
            </div>
            <div>
              <dt>Administradores</dt>
              <dd>{data.admins}</dd>
            </div>
            <div>
              <dt>Cuentas sin perfil de app</dt>
              <dd>{data.missingProfiles}</dd>
            </div>
          </dl>
          <p className={styles.caption}>
            Este estado refleja la configuración y los registros, no comprueba
            la disponibilidad del proveedor.
          </p>
        </section>
      </div>
      <section className={styles.card}>
        <span className={styles.eyebrow}>LÍMITES VIGENTES</span>
        <h2>Catálogo de planes</h2>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Chat diario / mes</th>
                <th>Chat personas / mes</th>
                <th>Informes IA / mes</th>
              </tr>
            </thead>
            <tbody>
              {data.catalog.map((plan) => (
                <tr key={plan.id}>
                  <th>{planLabel(plan.id)}</th>
                  {[
                    plan.personal_chat_messages,
                    plan.person_chat_messages,
                    plan.statistics_access,
                  ].map((limit, i) => (
                    <td key={i}>
                      {limit === -1 ? "Ilimitado" : number(limit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
