"use client";
import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiActivity,
  FiArrowUpRight,
  FiBookOpen,
  FiCalendar,
  FiHeart,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import {
  MOOD_KEYS,
  type DiaryAnalytics,
  type MoodKey,
} from "@/lib/diary-analytics";
import { moodDistribution } from "@/lib/mood-distribution";
import EmotionTooltip, { type EmotionChartPoint } from "./EmotionTooltip";
import PeopleBubbles from "./PeopleBubbles";
import PersonEmotions from "./PersonEmotions";
import PersonEmotionDialog from "./PersonEmotionDialog";
import ConnectionDetails from "./ConnectionDetails";
import {
  emotions,
  timelineEmotions,
  shortDate,
  fullDate,
  timelineDateLabel,
  percentage,
} from "./presentation";
import s from "./StatisticsDashboard.module.css";
export { shortDate } from "./presentation";
const number = (n: number) => n.toLocaleString("es");
export default function StatisticsDashboard({
  data,
  onOpenEntry,
  onOpenPerson,
  preview = false,
}: {
  data: DiaryAnalytics;
  onOpenEntry?: (date: string) => void;
  onOpenPerson?: (name: string) => void;
  preview?: boolean;
}) {
  const [selectedName, setSelectedName] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const searchKey = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
  const filteredPeople = data.people.filter((person) =>
    searchKey(person.name).includes(searchKey(personSearch.trim())),
  );
  const [peoplePage, setPeoplePage] = useState(0);
  const [mapMode, setMapMode] = useState<"people" | "connections">("people");
  const [connectionKey, setConnectionKey] = useState("");
  const [rankedEmotion, setRankedEmotion] = useState<MoodKey | null>(null);
  const connections = data.connections || [];
  const regularPage = Math.min(
    peoplePage,
    Math.max(0, Math.ceil(filteredPeople.length / 12) - 1),
  );
  const regularPeople = filteredPeople.slice(
    regularPage * 12,
    (regularPage + 1) * 12,
  );
  const selected =
    mapMode === "connections"
      ? filteredPeople.find((person) => person.name === selectedName) ||
        filteredPeople[0]
      : regularPeople.find((person) => person.name === selectedName) ||
        regularPeople[0];
  const incident = connections.filter(
    (connection) =>
      connection.source === selected?.name ||
      connection.target === selected?.name,
  );
  const neighbours = incident
    .map((connection) =>
      data.people.find(
        (person) =>
          person.name ===
          (connection.source === selected?.name
            ? connection.target
            : connection.source),
      ),
    )
    .filter((person): person is (typeof data.people)[number] => !!person);
  const groupSize = mapMode === "connections" ? 11 : 12;
  const groupedPeople = mapMode === "connections" ? neighbours : filteredPeople;
  const pageCount = Math.ceil(groupedPeople.length / groupSize);
  const page = Math.min(peoplePage, Math.max(0, pageCount - 1));
  const visiblePeople =
    mapMode === "connections"
      ? selected
        ? [selected, ...neighbours.slice(page * 11, (page + 1) * 11)]
        : []
      : regularPeople;
  const visibleNames = new Set(visiblePeople.map((person) => person.name));
  const visibleConnections = (mapMode === "connections" ? incident : []).filter(
    (connection) =>
      visibleNames.has(connection.source) &&
      visibleNames.has(connection.target),
  );
  const selectedConnection = visibleConnections.find(
    (connection) => connection.key === connectionKey,
  );
  const selectPerson = (name: string) => {
    setSelectedName(name);
    setConnectionKey("");
    if (mapMode === "connections") {
      setPersonSearch("");
      setPeoplePage(0);
    }
  };
  const [visible, setVisible] = useState<MoodKey[]>([
    "happiness",
    "tranquility",
    "stress",
    "sadness",
    "neutral",
  ]);

  const [calendarDate, setCalendarDate] = useState("");
  const periodDistribution = moodDistribution(data.averages);
  const emotionTimeline: EmotionChartPoint[] = data.timeline
    .filter((point) => point.samples > 0)
    .map((point) => {
      const distribution = moodDistribution(point);
      return {
        ...point,
        distribution,
        // Layout zero for missing dimensions is never presented as an evaluated zero.
        shares: Object.fromEntries(
          MOOD_KEYS.map((key) => [key, distribution.percentages[key] ?? 0]),
        ) as Record<MoodKey, number>,
      };
    });
  const tickStep = Math.max(1, Math.ceil(emotionTimeline.length / 6));
  const emotionTicks = emotionTimeline
    .filter(
      (_, index) =>
        index % tickStep === 0 || index === emotionTimeline.length - 1,
    )
    .map((point) => point.date);
  const [showMoodTable, setShowMoodTable] = useState(false);
  return (
    <>
      <section className={s.hero}>
        <div>
          <span className={s.eyebrow}>
            <FiActivity /> TU DIARIO, VISTO DESDE ARRIBA
          </span>
          <h1>Tu vida, en perspectiva.</h1>
          <p>
            Personas, emociones y recuerdos.
            <br />
            Descubre los hilos de tu historia.
          </p>
          <div className={s.heroPills}>
            <span>
              <FiCalendar /> {fullDate(data.start)} — {fullDate(data.end)}
            </span>
            <span>
              <FiUsers /> {data.people.length} personas
            </span>
          </div>
        </div>
        <div
          className={s.heroVisual}
          aria-label={`${data.entryCount} días escritos`}
        >
          <div className={s.heroRing} />
          <div className={s.heroRingSmall} />
          <FiBookOpen />
          <strong>{number(data.entryCount)}</strong>
          <span>días de tu historia</span>
          <i className={s.heroSpark}>
            <FiZap />
          </i>
        </div>
      </section>
      <div className={s.mainGrid}>
        <section className={`${s.card} ${s.peopleCard}`}>
          <div className={s.cardHeading}>
            <div>
              <span className={s.kicker}>
                <FiUsers /> CONEXIONES
              </span>
              <h2>Las personas de tu historia</h2>
            </div>
            <span className={s.badge}>{data.people.length} personas</span>
          </div>
          <p className={s.caption}>
            Cuanto mayor la burbuja, más entradas donde aparece. Toca una
            persona para ver sus emociones. Activa sus conexiones y toca una
            línea para abrir recuerdos compartidos.
          </p>
          <input
            className={s.personSearch}
            aria-label="Buscar una persona en estadísticas"
            placeholder="Buscar una persona…"
            value={personSearch}
            onChange={(event) => {
              setPersonSearch(event.target.value);
              setPeoplePage(0);
              setConnectionKey("");
            }}
          />
          <div className={s.mapControls}>
            <div className={s.mapTabs} aria-label="Vista del mapa de personas">
              <button
                aria-pressed={mapMode === "people"}
                onClick={() => {
                  setMapMode("people");
                  setPeoplePage(
                    Math.max(
                      0,
                      Math.floor(
                        filteredPeople.findIndex(
                          (person) => person.name === selected?.name,
                        ) / 12,
                      ),
                    ),
                  );
                  setConnectionKey("");
                }}
              >
                Personas
              </button>
              <button
                aria-pressed={mapMode === "connections"}
                disabled={!selected}
                onClick={() => {
                  setSelectedName(selected?.name || "");
                  setMapMode("connections");
                  setPeoplePage(0);
                  setConnectionKey("");
                }}
              >
                Conexiones de {selected?.name || "una persona"}
              </button>
            </div>
            <span>
              {mapMode === "connections"
                ? `${neighbours.length} personas aparecen en entradas con ${selected?.name || "esta persona"}`
                : "Activa las conexiones para explorar entradas en común"}
            </span>
          </div>
          <div className={s.peopleGrid}>
            <PeopleBubbles
              people={visiblePeople}
              selected={selected?.name || ""}
              onSelect={selectPerson}
              connections={visibleConnections}
              selectedConnection={selectedConnection?.key}
              onSelectConnection={setConnectionKey}
              preview={preview}
              network={mapMode === "connections"}
            />
            <div className={s.personDetail}>
              {selected ? (
                <>
                  <span className={s.personInitial}>
                    {selected.name.slice(0, 1)}
                  </span>
                  <h3>{selected.name}</h3>
                  <strong>
                    {selected.count} <small>entradas</small>
                  </strong>
                  <div className={s.shareTrack}>
                    <span style={{ width: `${selected.share}%` }} />
                  </div>
                  <p>
                    Aparece en el {selected.share}% de tus entradas del periodo.
                  </p>
                  <PersonEmotions
                    person={selected}
                    onSelectEmotion={setRankedEmotion}
                    preview={preview}
                  />
                  <button
                    className={s.textButton}
                    disabled={preview || !onOpenPerson}
                    onClick={() => onOpenPerson?.(selected.name)}
                  >
                    Ver ficha de {selected.name}
                    <FiArrowUpRight />
                  </button>
                </>
              ) : (
                <p>
                  Las personas aparecerán al analizar entradas donde las
                  menciones.
                </p>
              )}
            </div>
          </div>
          {pageCount > 1 && (
            <nav className={s.bubblePagination} aria-label="Grupos de personas">
              <button
                disabled={page === 0}
                onClick={() => setPeoplePage(page - 1)}
              >
                Anterior grupo
              </button>
              <span>
                {page * groupSize + 1}–
                {Math.min((page + 1) * groupSize, groupedPeople.length)} de{" "}
                {groupedPeople.length} personas
              </span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPeoplePage(page + 1)}
              >
                Siguiente grupo
              </button>
            </nav>
          )}
          {mapMode === "connections" && !incident.length && (
            <p className={s.emotionEmpty}>
              No hay entradas del periodo donde{" "}
              {selected?.name || "esta persona"} aparezca con otras personas.
            </p>
          )}
          <p className={s.footnote}>
            Contamos una mención por persona y entrada. Una conexión significa
            aparecer en la misma entrada, no haber quedado ni conocerse.
          </p>
          {selectedConnection && !preview && (
            <ConnectionDetails
              key={`${data.period}:${selectedConnection.key}:${selectedConnection.dates.join(",")}`}
              connection={selectedConnection}
              period={data.period}
              onOpenEntry={onOpenEntry}
              onClose={() => setConnectionKey("")}
            />
          )}
          {selected && rankedEmotion && !preview && (
            <PersonEmotionDialog
              key={`${data.period}:${selected.name}`}
              person={selected}
              period={data.period}
              initialEmotion={rankedEmotion}
              onOpenEntry={onOpenEntry}
              onClose={() => setRankedEmotion(null)}
            />
          )}
        </section>
        <section className={`${s.card} ${s.emotionsCard}`}>
          <div className={s.cardHeading}>
            <div>
              <span className={s.kicker}>
                <FiHeart /> EMOCIONES
              </span>
              <h2>Cómo has ido sintiéndote</h2>
            </div>
            <span className={s.badge}>{data.moodSamples} días analizados</span>
          </div>
          <p className={s.caption}>
            Cada columna reparte el 100 % entre las emociones de una entrada.
            Pulsa una emoción para destacarla; pulsa de nuevo para verlas todas.
            Las tarjetas resumen el reparto de las medias del periodo.
          </p>
          <div className={s.emotionFilters}>
            {timelineEmotions.map((e) => (
              <button
                key={e.key}
                aria-pressed={visible.includes(e.key)}
                disabled={periodDistribution.percentages[e.key] == null}
                onClick={() =>
                  setVisible((keys) =>
                    keys.length === 1 && keys[0] === e.key
                      ? [...MOOD_KEYS]
                      : [e.key],
                  )
                }
                style={{ "--emotion-color": e.color } as React.CSSProperties}
              >
                <span>
                  <i />
                  {e.label}
                </span>
                <strong>
                  {percentage(periodDistribution.percentages[e.key])}
                </strong>
              </button>
            ))}
          </div>
          {emotionTimeline.some((point) => point.distribution.total > 0) ? (
            <div
              className={s.chart}
              role="img"
              aria-label="Reparto emocional: columnas apiladas de 0 a 100 %"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={emotionTimeline}
                  margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid stroke="#edeaf4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    ticks={emotionTicks}
                    tickFormatter={(value) =>
                      (data.totalDays > 365 ? fullDate : shortDate)(
                        String(value),
                      )
                    }
                    minTickGap={45}
                    tick={{ fontSize: 11, fill: "#89869b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(value) => `${value} %`}
                    tick={{ fontSize: 11, fill: "#89869b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<EmotionTooltip />}
                    filterNull={false}
                    cursor={{ fill: "#f3effb" }}
                  />
                  {[...timelineEmotions].reverse().map((e) => (
                    <Bar
                      key={e.key}
                      dataKey={`shares.${e.key}`}
                      name={e.label}
                      stackId="emotions"
                      fill={e.color}
                      fillOpacity={visible.includes(e.key) ? 1 : 0.18}
                      maxBarSize={56}
                      isAnimationActive={!preview}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={s.emptyChart}>
              <FiHeart />
              <h3>
                {data.moodSamples
                  ? "No hay un reparto emocional calculable"
                  : "Todavía no hay emociones analizadas"}
              </h3>
              <p>
                {data.moodSamples
                  ? "Las puntuaciones disponibles suman 0. Puedes revisar los valores originales."
                  : "Analiza una entrada de tu diario o amplía el periodo para empezar a ver tu evolución."}
              </p>
            </div>
          )}
          <p className={s.footnote}>
            {data.bucketDays > 1
              ? "Últimos 30 días por entrada; historia anterior agrupada en medias con su intervalo de fechas. "
              : "Una columna por entrada analizada. "}
            Entradas en orden cronológico; se omiten los días sin datos.
            Porcentaje = puntuación ÷ suma de puntuaciones × 100. Es un reparto
            relativo, no la intensidad absoluta. Las emociones sin evaluar no
            cuentan como cero.
          </p>
          {!!data.moodSamples && (
            <>
              <button
                className={s.textButton}
                aria-expanded={showMoodTable}
                onClick={() => setShowMoodTable(!showMoodTable)}
              >
                {showMoodTable
                  ? "Ocultar datos emocionales"
                  : "Ver datos emocionales"}
              </button>
              {showMoodTable && (
                <div className={s.dataTable}>
                  <table>
                    <caption>
                      Intensidades originales (0–100) · fechas reales e
                      intervalos de las medias
                    </caption>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        {emotions.map((emotion) => (
                          <th key={emotion.key}>{emotion.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.timeline
                        .filter((point) =>
                          emotions.some(
                            (emotion) => point[emotion.key] != null,
                          ),
                        )
                        .map((point) => (
                          <tr key={point.date}>
                            <th>{timelineDateLabel(point)}</th>
                            {emotions.map((emotion) => (
                              <td key={emotion.key}>
                                {point[emotion.key] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <div className={s.insight}>
            <FiActivity />
            <p>
              {data.moodSamples ? (
                <>
                  <strong>
                    {data.moodSamples} de {data.entryCount} entradas tienen
                    datos emocionales.
                  </strong>{" "}
                  La gráfica refleja lo que has analizado; las demás entradas
                  también cuentan en tu actividad.
                </>
              ) : (
                <>
                  <strong>Cada entrada añade una pieza.</strong> No hace falta
                  escribir mucho para empezar a descubrir patrones.
                </>
              )}
            </p>
          </div>
        </section>
        <section className={s.card}>
          <div className={s.cardHeading}>
            <div>
              <span className={s.kicker}>
                <FiCalendar /> CALENDARIO EMOCIONAL
              </span>
              <h2>El color de tus días</h2>
            </div>
            <span className={s.badge}>12 semanas</span>
          </div>
          <p className={s.caption}>
            {fullDate(data.calendarStart)} — {fullDate(data.calendarEnd)}. Cada
            color representa la emoción con mayor puntuación de ese día. Toca un
            día para abrirlo.
          </p>
          <div className={s.emotionLegend}>
            {emotions.map((emotion) => (
              <span key={emotion.key}>
                <i style={{ background: emotion.color }} />
                {emotion.label}
              </span>
            ))}
            <span>
              <i className={s.unanalyzedSwatch} />
              Sin analizar
            </span>
            <span>
              <i className={s.mixedSwatch} />
              Empate
            </span>
          </div>
          <div className={s.calendarLayout}>
            <div className={s.weekdayLabels} aria-hidden="true">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className={s.heatmap}>
              {data.calendar.map((day) => {
                const dominant = emotions.filter((emotion) =>
                  day.dominantEmotions.includes(emotion.key),
                );
                const description = !day.hasEntry
                  ? "sin entrada"
                  : !dominant.length
                    ? "sin análisis emocional"
                    : `${dominant.map((e) => e.label).join(" y ")} · ${day.dominantScore}/100${dominant.length > 1 ? " (empate)" : ""}`;
                const label = `${fullDate(day.date)} · ${description}`;
                const background =
                  dominant.length === 1
                    ? dominant[0].color
                    : dominant.length > 1
                      ? `linear-gradient(135deg, ${dominant.map((e, i) => `${e.color} ${(i * 100) / dominant.length}%, ${e.color} ${((i + 1) * 100) / dominant.length}%`).join(", ")})`
                      : undefined;
                return (
                  <button
                    key={day.date}
                    aria-label={label}
                    disabled={!day.hasEntry || preview || !onOpenEntry}
                    className={
                      day.hasEntry && !dominant.length
                        ? s.unanalyzedDay
                        : undefined
                    }
                    style={{ background }}
                    onFocus={() => setCalendarDate(label)}
                    onMouseEnter={() => setCalendarDate(label)}
                    onClick={() => onOpenEntry?.(day.date)}
                    title={label}
                  />
                );
              })}
            </div>
          </div>
          <p className={s.calendarLegend} aria-live="polite">
            {calendarDate ||
              "Cada columna es una semana. Los días sin entrada quedan vacíos."}
          </p>
          <p className={s.footnote}>
            Los empates combinan los colores. Un día sin análisis no se
            interpreta como una emoción neutra.
          </p>
        </section>
      </div>
    </>
  );
}
