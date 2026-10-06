// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PeopleGraphDialog from "@/components/statistics/PeopleGraphDialog";
import { layoutPeopleGraph } from "@/components/statistics/PeopleGraphDialog";
import { PREVIEW_ANALYTICS } from "@/components/statistics/preview-data";

describe("complete people graph layout", () => {
  it("keeps all 151 people, separates bubbles and fits every ring", () => {
    const people = Array.from({ length: 151 }, (_, index) => ({
      ...PREVIEW_ANALYTICS.people[0],
      name: `Person ${index}`,
      count: index + 1,
    }));
    const { nodes, size } = layoutPeopleGraph(people, "Person 150");
    expect(nodes).toHaveLength(151);
    expect(nodes[0].person.name).toBe("Person 150");
    for (const [index, node] of nodes.entries()) {
      expect(Math.abs(node.x) + node.r).toBeLessThan(size / 2);
      expect(Math.abs(node.y) + node.r).toBeLessThan(size / 2);
      for (const other of nodes.slice(index + 1)) {
        expect(Math.hypot(node.x - other.x, node.y - other.y)).toBeGreaterThan(
          node.r + other.r,
        );
      }
    }
  });
});

beforeEach(() => {
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId || 1;
      }
    },
  );
  SVGElement.prototype.setPointerCapture = vi.fn();
  SVGElement.prototype.hasPointerCapture = vi.fn(() => true);
  SVGElement.prototype.releasePointerCapture = vi.fn();
});
it("drags without selecting, pans the background and restores the map", () => {
  const first = PREVIEW_ANALYTICS.people[0];
  const other = PREVIEW_ANALYTICS.people[1];
  render(
    <PeopleGraphDialog
      data={PREVIEW_ANALYTICS}
      initialName={first.name}
      initialScope="all"
      onClose={vi.fn()}
      preview
    />,
  );
  const svg = screen.getByRole("group", {
    name: "Mapa completo de conexiones",
  });
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 650,
    bottom: 650,
    width: 650,
    height: 650,
    toJSON() {},
  });
  const node = screen.getByRole("button", {
    name: `Seleccionar ${other.name}: ${other.count} entradas`,
  });
  const original = node.getAttribute("transform");
  fireEvent.pointerDown(node, {
    pointerId: 1,
    button: 0,
    clientX: 200,
    clientY: 200,
  });
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: 250, clientY: 230 });
  fireEvent.pointerUp(svg, { pointerId: 1 });
  fireEvent.click(node, { detail: 1 });
  expect(node.getAttribute("transform")).not.toBe(original);
  expect(node).toHaveAttribute("aria-pressed", "false");
  const viewBox = svg.getAttribute("viewBox");
  fireEvent.pointerDown(svg, {
    pointerId: 2,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(svg, { pointerId: 2, clientX: 160, clientY: 140 });
  fireEvent.pointerUp(svg, { pointerId: 2 });
  expect(svg.getAttribute("viewBox")).not.toBe(viewBox);
  fireEvent.click(
    screen.getByRole("button", { name: "Encajar y recolocar mapa" }),
  );
  expect(node.getAttribute("transform")).toBe(original);
  expect(svg.getAttribute("viewBox")).toBe(viewBox);
  fireEvent.pointerDown(node, {
    pointerId: 3,
    button: 0,
    clientX: 200,
    clientY: 200,
  });
  fireEvent.pointerUp(svg, { pointerId: 3 });
  fireEvent.click(node, { detail: 1 });
  expect(node).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("heading", { name: `Conexiones de ${other.name}` }),
  ).toBeVisible();
});
