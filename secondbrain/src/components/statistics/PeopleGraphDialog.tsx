"use client";

import { personLabel } from "@/lib/diary-analytics";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiMinus, FiPlus, FiMaximize, FiX } from "react-icons/fi";
import type { DiaryAnalytics, PersonMetric } from "@/lib/diary-analytics";
import ConnectionDetails from "./ConnectionDetails";
import s from "./StatisticsDashboard.module.css";

// Concentric rings reserve enough circumference for every bubble: no page or node cap.
export function layoutPeopleGraph(people: PersonMetric[], focus: string) {
  const ordered = [...people].sort(
    (a, b) => Number(b.name === focus) - Number(a.name === focus),
  );
  const nodes: { person: PersonMetric; x: number; y: number; r: number }[] = [];
  const max = Math.max(1, ...people.map((p) => p.count));
  let index = 0;
  if (ordered.length) {
    nodes.push({ person: ordered[0], x: 0, y: 0, r: 56 });
    index = 1;
  }
  let ring = 1;
  while (index < ordered.length) {
    const radius = ring * 150;
    const count = Math.min(
      ordered.length - index,
      Math.floor((2 * Math.PI * radius) / 110),
    );
    for (let i = 0; i < count; i++, index++) {
      const angle =
        -Math.PI / 2 + (i / count) * 2 * Math.PI + (ring % 2 ? 0 : 0.15);
      const person = ordered[index];
      nodes.push({
        person,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        r: 30 + 18 * Math.sqrt(person.count / max),
      });
    }
    ring++;
  }
  return { nodes, size: Math.max(650, (ring - 1) * 300 + 140) };
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
const colors = ["#ede4fa", "#dff4ee", "#e5edfc", "#f8e8ee"];
export default function PeopleGraphDialog({
  data,
  initialName,
  initialScope,
  onClose,
  onOpenEntry,
  onOpenPerson,
  preview = false,
}: {
  data: DiaryAnalytics;
  initialName: string;
  initialScope: "person" | "all";
  onClose: () => void;
  onOpenEntry?: (date: string) => void;
  onOpenPerson?: (name: string) => void;
  preview?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const title = useId();
  const [scope, setScope] = useState(initialScope);
  const [focus, setFocus] = useState(initialName);
  const [selected, setSelected] = useState(initialName);
  const [query, setQuery] = useState("");
  const [edgeKey, setEdgeKey] = useState("");
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const drag = useRef<{
    name?: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
    clientX: number;
    clientY: number;
    moved: boolean;
  } | null>(null);
  const suppress = useRef(false);
  const incident = (data.connections || []).filter(
    (c) => c.source === focus || c.target === focus,
  );
  const people = useMemo(() => {
    if (scope === "all") return data.people;
    const names = new Set([focus]);
    for (const connection of data.connections || []) {
      if (connection.source === focus || connection.target === focus) {
        names.add(connection.source);
        names.add(connection.target);
      }
    }
    return data.people.filter((person) => names.has(person.name));
  }, [data.people, data.connections, scope, focus]);
  const edges = scope === "all" ? data.connections || [] : incident;
  const layout = useMemo(
    () => layoutPeopleGraph(people, focus),
    [people, focus],
  );
  const nodes = layout.nodes.map((n) => ({
    ...n,
    ...(positions[n.person.name] || {}),
  }));
  const byName = new Map(nodes.map((n) => [n.person.name, n]));
  const chosen = data.people.find((p) => p.name === selected);
  const chosenEdge = edges.find((c) => c.key === edgeKey);
  const list = people.filter((p) =>
    normalize(`${personLabel(p)} ${p.relationship || ""}`).includes(
      normalize(query.trim()),
    ),
  );
  const reset = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
    setPositions({});
  };
  const changeScope = (next: "all" | "person") => {
    setScope(next);
    setEdgeKey("");
    setQuery("");
    reset();
  };
  const select = (name: string) => {
    setSelected(name);
    setFocus(name);
    changeScope("person");
  };
  const zoom = (factor: number) =>
    setCamera((c) => ({
      ...c,
      zoom: Math.max(0.5, Math.min(5, c.zoom * factor)),
    }));
  const point = (event: { clientX: number; clientY: number }) => {
    const element = svg.current!;
    const matrix = element.getScreenCTM?.();
    if (matrix && element.createSVGPoint) {
      const p = element.createSVGPoint();
      p.x = event.clientX;
      p.y = event.clientY;
      return p.matrixTransform(matrix.inverse());
    }
    const rect = element.getBoundingClientRect();
    const scale = layout.size / Math.max(1, Math.min(rect.width, rect.height));
    return {
      x: (event.clientX - rect.left - rect.width / 2) * scale,
      y: (event.clientY - rect.top - rect.height / 2) * scale,
    };
  };
  useEffect(() => {
    const element = svg.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setCamera((c) => ({
        ...c,
        zoom: Math.max(
          0.5,
          Math.min(5, c.zoom * Math.exp(-event.deltaY * 0.0015)),
        ),
      }));
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    const el = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    if (el?.showModal) el.showModal();
    else el?.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    return () => {
      el?.close?.();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={title}
      className={s.graphDialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className={s.graphHeader}>
        <div>
          <span className={s.kicker}>TU MAPA DE PERSONAS</span>
          <h2 id={title}>
            {scope === "person"
              ? `Conexiones de ${focus}`
              : "Todas las personas de tu historia"}
          </h2>
          <p>
            {scope === "person"
              ? `${Math.max(0, people.length - 1)} personas conectadas con ${focus}`
              : `${people.length} personas · ${edges.length} conexiones`}{" "}
            · Mapa completo, sin grupos
          </p>
        </div>
        <button
          className={s.graphIconButton}
          aria-label="Cerrar mapa completo"
          onClick={onClose}
        >
          <FiX />
        </button>
      </header>
      <div className={s.graphBody}>
        <div className={s.graphMain}>
          <div className={s.graphActions}>
            <div className={s.mapTabs}>
              <button
                aria-pressed={scope === "person"}
                onClick={() => changeScope("person")}
              >
                Conexiones de {focus}
              </button>
              <button
                aria-pressed={scope === "all"}
                onClick={() => changeScope("all")}
              >
                Toda la red
              </button>
            </div>
            <div className={s.graphZoom}>
              <button aria-label="Alejar mapa" onClick={() => zoom(1 / 1.3)}>
                <FiMinus />
              </button>
              <span>{Math.round(camera.zoom * 100)}%</span>
              <button aria-label="Acercar mapa" onClick={() => zoom(1.3)}>
                <FiPlus />
              </button>
              <button aria-label="Encajar y recolocar mapa" onClick={reset}>
                <FiMaximize />
              </button>
            </div>
          </div>
          <div className={s.graphCanvas}>
            <svg
              ref={svg}
              viewBox={`${-layout.size / (2 * camera.zoom) - camera.x} ${-layout.size / (2 * camera.zoom) - camera.y} ${layout.size / camera.zoom} ${layout.size / camera.zoom}`}
              aria-label="Mapa completo de conexiones"
              role="group"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                suppress.current = false;
                const p = point(event);
                drag.current = {
                  x: p.x,
                  y: p.y,
                  originX: camera.x,
                  originY: camera.y,
                  clientX: event.clientX,
                  clientY: event.clientY,
                  moved: false,
                };
                const captureTarget =
                  (event.target as Element).closest("[role=button]") ||
                  event.currentTarget;
                captureTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const d = drag.current;
                if (!d) return;
                const p = point(event);
                const dx = p.x - d.x,
                  dy = p.y - d.y;
                if (
                  Math.hypot(
                    event.clientX - d.clientX,
                    event.clientY - d.clientY,
                  ) > 5
                )
                  d.moved = true;
                if (!d.moved) return;
                if (d.name)
                  setPositions((previous) => ({
                    ...previous,
                    [d.name!]: { x: d.originX + dx, y: d.originY + dy },
                  }));
                else {
                  setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
                }
              }}
              onPointerUp={(event) => {
                suppress.current = !!drag.current?.moved;
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
                suppress.current = true;
              }}
              onLostPointerCapture={() => {
                if (drag.current) {
                  suppress.current = drag.current.moved;
                  drag.current = null;
                }
              }}
              onClickCapture={(event) => {
                if (suppress.current && event.detail !== 0) {
                  event.preventDefault();
                  event.stopPropagation();
                  suppress.current = false;
                }
              }}
            >
              {edges.map((edge) => {
                const a = byName.get(edge.source),
                  b = byName.get(edge.target);
                if (!a || !b) return null;
                const active =
                  edge.key === edgeKey ||
                  edge.source === selected ||
                  edge.target === selected;
                const neighbour = edge.source === focus ? b : a;
                const centre = edge.source === focus ? a : b;
                const distance = Math.hypot(
                  neighbour.x - centre.x,
                  neighbour.y - centre.y,
                );
                const ratio = Math.max(
                  0.5,
                  1 - (neighbour.r + 22) / Math.max(1, distance),
                );
                const badgeX = centre.x + (neighbour.x - centre.x) * ratio;
                const badgeY = centre.y + (neighbour.y - centre.y) * ratio;

                return (
                  <g
                    key={edge.key}
                    role="button"
                    tabIndex={preview ? -1 : 0}
                    aria-disabled={preview}
                    aria-label={`Ver conexión entre ${edge.sourceLabel || edge.source} y ${edge.targetLabel || edge.target}: ${edge.count} entradas compartidas`}
                    onClick={() => !preview && setEdgeKey(edge.key)}
                    onKeyDown={(event) => {
                      if (
                        !preview &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        setEdgeKey(edge.key);
                      }
                    }}
                  >
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={18}
                    />
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={active ? "#a48ac7" : "#ddd5e9"}
                      strokeWidth={active ? 2.5 : 1}
                      opacity={active ? 0.85 : 0.35}
                    />
                    {scope === "person" && (
                      <g
                        transform={`translate(${badgeX} ${badgeY})`}
                        aria-hidden="true"
                      >
                        <circle
                          r={15}
                          fill="#fcfaff"
                          stroke="#d8c9ed"
                          strokeWidth={1.5}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#9371bc"
                          fontSize={12}
                          fontWeight={600}
                          style={{ pointerEvents: "none", userSelect: "none" }}
                        >
                          {edge.count}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              {nodes.map((node, i) => (
                <g
                  key={node.person.name}
                  transform={`translate(${node.x} ${node.y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === node.person.name}
                  aria-label={`Seleccionar ${personLabel(node.person)}${node.person.relationship ? ` (${node.person.relationship})` : ""}: ${node.person.count} entradas`}
                  className={s.graphNode}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    suppress.current = false;
                    const p = point(event);
                    drag.current = {
                      name: node.person.name,
                      x: p.x,
                      y: p.y,
                      originX: node.x,
                      originY: node.y,
                      clientX: event.clientX,
                      clientY: event.clientY,
                      moved: false,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onClick={() => select(node.person.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select(node.person.name);
                    }
                  }}
                >
                  <circle
                    r={node.r}
                    fill={
                      selected === node.person.name
                        ? "#9874c5"
                        : colors[i % colors.length]
                    }
                    stroke={
                      normalize(personLabel(node.person)).includes(
                        normalize(query.trim()),
                      ) && query.trim()
                        ? "#7652b2"
                        : "#fff"
                    }
                    strokeWidth={3}
                  />
                  <text
                    textAnchor="middle"
                    fill={selected === node.person.name ? "white" : "#655080"}
                    fontSize={11}
                    fontWeight={600}
                    y={-9}
                  >
                    {personLabel(node.person).length > 15
                      ? `${personLabel(node.person).slice(0, 14)}…`
                      : personLabel(node.person)}
                  </text>
                  <text
                    textAnchor="middle"
                    fill={selected === node.person.name ? "white" : "#655080"}
                    fontSize={24}
                    y={17}
                  >
                    {node.person.count}
                  </text>
                  <title>
                    {personLabel(node.person)}: {node.person.count} entradas
                  </title>
                </g>
              ))}
            </svg>
            <p className={s.graphHint}>
              Arrastra el fondo para recorrer el mapa y las burbujas para
              moverlas. Usa + para acercarte.
            </p>
          </div>
        </div>
        <aside className={s.graphAside} aria-label="Explorar personas del mapa">
          {chosenEdge && !preview ? (
            <ConnectionDetails
              embedded
              connection={chosenEdge}
              period={data.period}
              onClose={() => setEdgeKey("")}
              onOpenEntry={(date) => {
                onClose();
                onOpenEntry?.(date);
              }}
            />
          ) : (
            <>
              {chosen && (
                <div className={s.graphSelection}>
                  <h3>{personLabel(chosen)}</h3>
                  {chosen.relationship && <p>{chosen.relationship}</p>}
                  <p>
                    {chosen.count} entradas ·{" "}
                    {
                      (data.connections || []).filter(
                        (c) =>
                          c.source === chosen.name || c.target === chosen.name,
                      ).length
                    }{" "}
                    conexiones
                  </p>
                  <button
                    onClick={() => {
                      setFocus(chosen.name);
                      changeScope("person");
                    }}
                  >
                    Explorar sus conexiones
                  </button>
                  {onOpenPerson && !preview && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenPerson(chosen.name);
                      }}
                    >
                      Ver su ficha
                    </button>
                  )}
                </div>
              )}
              <label className={s.graphSearch}>
                Buscar en este mapa
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nombre de una persona…"
                />
              </label>
              <p className={s.graphListCount}>
                {list.length} de {people.length} personas · toca para ver sus
                conexiones
              </p>
              <div className={s.graphList}>
                {list.map((person) => (
                  <button
                    key={person.name}
                    aria-pressed={selected === person.name}
                    onClick={() => select(person.name)}
                  >
                    <span>
                      {personLabel(person)}
                      {person.relationship && (
                        <small> · {person.relationship}</small>
                      )}
                    </span>
                    <small>
                      {scope === "person" && person.name !== focus
                        ? `${incident.find((c) => c.source === person.name || c.target === person.name)?.count || 0} en común`
                        : `${person.count} entradas`}
                    </small>
                  </button>
                ))}
                {!list.length && (
                  <p>No hay personas con ese nombre en este mapa.</p>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
      <footer className={s.graphFooter}>
        Una conexión significa aparecer en una misma entrada; no implica
        conocerse o haber quedado.
      </footer>
    </dialog>,
    document.body,
  );
}
