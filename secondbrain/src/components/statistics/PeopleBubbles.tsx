"use client";

import { personLabel } from "@/lib/diary-analytics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiMove,
  FiRotateCcw,
} from "react-icons/fi";
import type { PersonMetric, ConnectionMetric } from "@/lib/diary-analytics";
import s from "./StatisticsDashboard.module.css";

// Stable circle packing, constrained to the canvas. No physics loop or dependency.
export function packPeople(people: PersonMetric[]) {
  const maximum = Math.max(1, ...people.map((p) => p.count));
  const circles: { person: PersonMetric; x: number; y: number; r: number }[] =
    [];
  for (let scale = 1; scale >= 0.45; scale *= 0.88) {
    circles.length = 0;
    for (const person of people.slice(0, 12)) {
      const r = (26 + 40 * Math.sqrt(person.count / maximum)) * scale;
      for (let step = 0; step < 4000; step++) {
        const angle = step * 2.399963;
        const radius = 4 * Math.sqrt(step);
        const x = 300 + Math.cos(angle) * radius * 1.65;
        const y = 185 + Math.sin(angle) * radius;
        if (x - r < 10 || x + r > 590 || y - r < 10 || y + r > 360) continue;
        if (circles.some((c) => Math.hypot(x - c.x, y - c.y) < r + c.r + 9))
          continue;
        circles.push({ person, x, y, r });
        break;
      }
    }
    if (circles.length === Math.min(12, people.length)) break;
  }
  return circles;
}
// A focused map reserves space for clickable lines between the centre and its neighbours.
export function packNetworkPeople(people: PersonMetric[]) {
  const nodes = people.slice(0, 12);
  const maximum = Math.max(1, ...nodes.map((person) => person.count));
  for (let scale = 1; scale >= 0.35; scale *= 0.88) {
    const circles = nodes.map((person, index) => {
      const angle =
        -Math.PI / 2 +
        ((index - 1) * Math.PI * 2) / Math.max(1, nodes.length - 1);
      return {
        person,
        x: index ? 300 + 220 * Math.cos(angle) : 300,
        y: index ? 185 + 120 * Math.sin(angle) : 185,
        r: (26 + 34 * Math.sqrt(person.count / maximum)) * scale,
      };
    });
    if (
      circles.every(
        (circle, index) =>
          circle.x - circle.r >= 10 &&
          circle.x + circle.r <= 590 &&
          circle.y - circle.r >= 10 &&
          circle.y + circle.r <= 360 &&
          circles
            .slice(index + 1)
            .every(
              (other) =>
                Math.hypot(circle.x - other.x, circle.y - other.y) >=
                circle.r + other.r + 9,
            ),
      )
    )
      return circles;
  }
  return packPeople(nodes);
}
export default function PeopleBubbles({
  people,
  selected,
  onSelect,
  connections = [],
  selectedConnection = "",
  onSelectConnection,
  preview = false,
  network = false,
  pagination,
}: {
  people: PersonMetric[];
  selected: string;
  onSelect: (name: string) => void;
  connections?: ConnectionMetric[];
  selectedConnection?: string;
  onSelectConnection?: (key: string) => void;
  preview?: boolean;
  network?: boolean;
  pagination?: {
    previous: boolean;
    next: boolean;
    label: string;
    onPrevious: () => void;
    onNext: () => void;
  };
}) {
  const initialCircles = useMemo(
    () => (network ? packNetworkPeople(people) : packPeople(people)),
    [people, network],
  );
  const layoutKey = `${network}:${people.map((p) => `${p.name}:${p.count}`).join("|")}`;
  const [positions, setPositions] = useState<{
    key: string;
    points: Record<string, { x: number; y: number }>;
  }>({ key: "", points: {} });
  const [dragging, setDragging] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const workspace = canvas.current?.parentElement;
    if (!workspace) return;
    let previousWidth = -1;
    const centre = () => {
      if (workspace.clientWidth === previousWidth) return;
      previousWidth = workspace.clientWidth;
      workspace.scrollLeft = Math.max(
        0,
        (workspace.scrollWidth - workspace.clientWidth) / 2,
      );
    };
    centre();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(centre);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [layoutKey]);
  const drag = useRef<{
    name: string;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    moved: boolean;
    key: string;
  } | null>(null);
  const suppressClick = useRef<string | null>(null);
  const circles = initialCircles.map((circle) => ({
    ...circle,
    ...(positions.key === layoutKey
      ? positions.points[circle.person.name]
      : undefined),
  }));
  const movePerson = (name: string, x: number, y: number) => {
    const circle = circles.find((c) => c.person.name === name);
    if (!circle) return;
    const clamp = () => {
      x = Math.max(circle.r + 10, Math.min(590 - circle.r, x));
      y = Math.max(circle.r + 10, Math.min(360 - circle.r, y));
    };
    clamp();
    for (let pass = 0; pass < 8; pass++) {
      for (const other of circles) {
        if (other.person.name === name) continue;
        const dx = x - other.x,
          dy = y - other.y;
        const distance = Math.hypot(dx, dy),
          minimum = circle.r + other.r + 6;
        if (distance < minimum) {
          const angle = distance
            ? Math.atan2(dy, dx)
            : Math.atan2(circle.y - other.y, circle.x - other.x);
          x = other.x + Math.cos(angle) * minimum;
          y = other.y + Math.sin(angle) * minimum;
          clamp();
        }
      }
    }
    if (
      circles.some(
        (other) =>
          other.person.name !== name &&
          Math.hypot(x - other.x, y - other.y) < circle.r + other.r + 5,
      )
    )
      return;
    setPositions((previous) => ({
      key: layoutKey,
      points: {
        ...(previous.key === layoutKey ? previous.points : {}),
        [name]: { x, y },
      },
    }));
  };
  return (
    <div className={s.bubbleFrame}>
      <div className={s.bubbleWorkspace}>
        <div className={s.bubbleToolbar}>
          <span>
            <FiMove /> Arrastra las burbujas para explorar
          </span>
          <button
            type="button"
            onClick={() => {
              setPositions({ key: layoutKey, points: {} });
            }}
            aria-label="Recolocar las burbujas"
            title="Recolocar las burbujas"
          >
            <FiRotateCcw />
            <span>Recolocar</span>
          </button>
        </div>
        <div
          ref={canvas}
          className={s.bubbles}
          aria-label="Personas mencionadas en tu diario"
          onPointerDownCapture={() => {
            suppressClick.current = null;
          }}
          onClickCapture={(event) => {
            // Releasing pointer capture can target a line beneath the moved circle.
            if (suppressClick.current && event.detail !== 0) {
              suppressClick.current = null;
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <svg
            className={s.edgeLayer}
            viewBox="0 0 600 370"
            aria-label="Conexiones entre personas"
          >
            {connections.map((connection) => {
              const source = circles.find(
                (circle) => circle.person.name === connection.source,
              );
              const target = circles.find(
                (circle) => circle.person.name === connection.target,
              );
              if (!source || !target) return null;
              const length = Math.hypot(
                target.x - source.x,
                target.y - source.y,
              );
              if (length <= source.r + target.r + 6) return null;
              const dx = (target.x - source.x) / length,
                dy = (target.y - source.y) / length;
              const x1 = source.x + dx * (source.r + 3),
                y1 = source.y + dy * (source.r + 3);
              const x2 = target.x - dx * (target.r + 3),
                y2 = target.y - dy * (target.r + 3);
              const chosen = selectedConnection === connection.key;
              return (
                <g
                  key={connection.key}
                  role="button"
                  tabIndex={preview ? -1 : 0}
                  aria-disabled={preview || !onSelectConnection}
                  aria-pressed={chosen}
                  aria-label={`Ver conexión entre ${connection.sourceLabel || connection.source} y ${connection.targetLabel || connection.target}: ${connection.count} entradas`}
                  className={`${s.connectionEdge} ${chosen ? s.selectedEdge : ""}`}
                  onClick={() => {
                    if (!preview) onSelectConnection?.(connection.key);
                  }}
                  onKeyDown={(event) => {
                    if (
                      !preview &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onSelectConnection?.(connection.key);
                    }
                  }}
                >
                  <title>
                    {connection.sourceLabel || connection.source} y{" "}
                    {connection.targetLabel || connection.target}:{" "}
                    {connection.count} entradas
                  </title>
                  <line className={s.edgeHit} x1={x1} y1={y1} x2={x2} y2={y2} />
                  <line
                    className={s.edgeStroke}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    style={{
                      strokeWidth: Math.min(
                        5,
                        1.5 + Math.sqrt(connection.count) / 2,
                      ),
                    }}
                  />
                  <circle
                    className={s.edgeBadge}
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r="10"
                  />
                  <text
                    className={s.edgeCount}
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 + 3}
                  >
                    {connection.count}
                  </text>
                </g>
              );
            })}
          </svg>
          {circles.map(({ person, x, y, r }, i) => (
            <button
              key={person.name}
              type="button"
              aria-pressed={selected === person.name}
              aria-label={`${personLabel(person)}${person.relationship ? ` (${person.relationship})` : ""}: ${person.count} entradas`}
              title={`${personLabel(person)} aparece en ${person.count} entradas`}
              aria-description="Arrastra para mover. Usa las flechas para recolocar y Enter para seleccionar."
              onClick={(event) => {
                if (
                  suppressClick.current === person.name &&
                  event.detail !== 0
                ) {
                  suppressClick.current = null;
                  return;
                }
                onSelect(person.name);
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const bounds = canvas.current?.getBoundingClientRect();
                if (!bounds?.width || !bounds.height) return;
                suppressClick.current = null;
                drag.current = {
                  name: person.name,
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  x,
                  y,
                  width: bounds.width,
                  height: bounds.height,
                  moved: false,
                  key: layoutKey,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const active = drag.current;
                if (
                  !active ||
                  active.pointerId !== event.pointerId ||
                  active.key !== layoutKey
                )
                  return;
                const dx = event.clientX - active.startX,
                  dy = event.clientY - active.startY;
                if (!active.moved && Math.hypot(dx, dy) < 5) return;
                active.moved = true;
                setDragging(person.name);
                movePerson(
                  person.name,
                  active.x + (dx * 600) / active.width,
                  active.y + (dy * 370) / active.height,
                );
              }}
              onPointerUp={(event) => {
                if (drag.current?.pointerId !== event.pointerId) return;
                if (drag.current.moved) suppressClick.current = person.name;
                drag.current = null;
                setDragging(null);
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                suppressClick.current = person.name;
                drag.current = null;
                setDragging(null);
              }}
              onLostPointerCapture={() => {
                drag.current = null;
                setDragging(null);
              }}
              onKeyDown={(event) => {
                const delta = {
                  ArrowLeft: [-12, 0],
                  ArrowRight: [12, 0],
                  ArrowUp: [0, -12],
                  ArrowDown: [0, 12],
                }[
                  event.key as
                    "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"
                ];
                if (!delta) return;
                event.preventDefault();
                movePerson(person.name, x + delta[0], y + delta[1]);
              }}
              className={`${s.bubble} ${dragging === person.name ? s.draggingBubble : ""}`}
              style={{
                left: `${(x - r) / 6}%`,
                top: `${(y - r) / 3.7}%`,
                width: `${r / 3}%`,
                height: `${r / 1.85}%`,
              }}
            >
              <span className={`${s.bubbleSurface} ${s[`bubble${i % 4}`]}`}>
                <span>{personLabel(person)}</span>
                <strong>{person.count}</strong>
                <small>{person.relationship || "entradas"}</small>
              </span>
            </button>
          ))}
          {!people.length && (
            <p className={s.bubbleEmpty}>
              Tu mapa empieza con las personas que menciones en tu diario.
            </p>
          )}
        </div>
        <p className={s.mobileMapHint}>
          Desliza el fondo para recorrer el mapa. Arrastra una burbuja para
          moverla.
        </p>
      </div>
      {pagination && (
        <nav className={s.bubblePager} aria-label="Grupos del mapa de personas">
          <button
            type="button"
            className={s.bubblePrevious}
            disabled={!pagination.previous}
            onClick={pagination.onPrevious}
            aria-label="Anterior grupo"
            title="Anterior grupo"
          >
            <FiChevronLeft />
          </button>
          <span aria-live="polite">{pagination.label}</span>
          <button
            type="button"
            className={s.bubbleNext}
            disabled={!pagination.next}
            onClick={pagination.onNext}
            aria-label="Siguiente grupo"
            title="Siguiente grupo"
          >
            <FiChevronRight />
          </button>
        </nav>
      )}
    </div>
  );
}
