"use client";
import { useMemo } from "react";
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
}: {
  people: PersonMetric[];
  selected: string;
  onSelect: (name: string) => void;
  connections?: ConnectionMetric[];
  selectedConnection?: string;
  onSelectConnection?: (key: string) => void;
  preview?: boolean;
  network?: boolean;
}) {
  const circles = useMemo(
    () => (network ? packNetworkPeople(people) : packPeople(people)),
    [people, network],
  );
  return (
    <div className={s.bubbles} aria-label="Personas mencionadas en tu diario">
      <div className={s.orbitOne} />
      <div className={s.orbitTwo} />
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
          const length = Math.hypot(target.x - source.x, target.y - source.y);
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
              aria-label={`Ver conexión entre ${connection.source} y ${connection.target}: ${connection.count} entradas`}
              className={`${s.connectionEdge} ${chosen ? s.selectedEdge : ""}`}
              onClick={() => {
                if (!preview) onSelectConnection?.(connection.key);
              }}
              onKeyDown={(event) => {
                if (!preview && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelectConnection?.(connection.key);
                }
              }}
            >
              <title>
                {connection.source} y {connection.target}: {connection.count}{" "}
                entradas
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
          aria-label={`${person.name}: ${person.count} entradas`}
          title={`${person.name} aparece en ${person.count} entradas`}
          onClick={() => onSelect(person.name)}
          className={s.bubble}
          style={{
            left: `${(x - r) / 6}%`,
            top: `${(y - r) / 3.7}%`,
            width: `${r / 3}%`,
            height: `${r / 1.85}%`,
            animationDelay: `${-i * 0.6}s`,
          }}
        >
          <span className={`${s.bubbleSurface} ${s[`bubble${i % 4}`]}`}>
            <span>{person.name}</span>
            <strong>{person.count}</strong>
            <small>entradas</small>
          </span>
        </button>
      ))}
      {!people.length && (
        <p className={s.bubbleEmpty}>
          Tu mapa empieza con las personas que menciones en tu diario.
        </p>
      )}
    </div>
  );
}
