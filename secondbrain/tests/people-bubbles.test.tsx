// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PeopleBubbles from '@/components/statistics/PeopleBubbles';
import { PREVIEW_ANALYTICS } from '@/components/statistics/preview-data';

beforeEach(() => {
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId || 1; }
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
const person = PREVIEW_ANALYTICS.people[0];
function bounds() {
  const canvas = screen.getByLabelText('Personas mencionadas en tu diario');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 370, width: 600, height: 370, toJSON() {} });
}
it('drags a bubble without selecting it, keeps it within the canvas and restores the layout', () => {
  const select = vi.fn();
  render(<PeopleBubbles people={[person]} selected={person.name} onSelect={select} />);
  bounds();
  const bubble = screen.getByRole('button', { name: `${person.name}: ${person.count} entradas` });
  const original = bubble.style.left;
  fireEvent.pointerDown(bubble, { pointerId: 1, button: 0, clientX: 300, clientY: 185 });
  fireEvent.pointerMove(bubble, { pointerId: 1, clientX: 400, clientY: 225 });
  fireEvent.pointerUp(bubble, { pointerId: 1 });
  expect(bubble.style.left).not.toBe(original);
  fireEvent.click(bubble, { detail: 1 });
  expect(select).not.toHaveBeenCalled();
  fireEvent.pointerDown(bubble, { pointerId: 1, button: 0, clientX: 400, clientY: 225 });
  fireEvent.pointerMove(bubble, { pointerId: 1, clientX: 3000, clientY: -3000 });
  fireEvent.pointerUp(bubble, { pointerId: 1 });
  expect(parseFloat(bubble.style.left) + parseFloat(bubble.style.width)).toBeLessThanOrEqual(100);
  expect(parseFloat(bubble.style.top)).toBeGreaterThanOrEqual(0);
  fireEvent.click(screen.getByRole('button', { name: 'Recolocar las burbujas' }));
  expect(bubble.style.left).toBe(original);
});
it('a tap still selects, while arrow keys move a bubble and update its connection', () => {
  const select = vi.fn();
  const people = PREVIEW_ANALYTICS.people.slice(0, 2);
  const connection = { key: 'test', source: people[0].name, target: people[1].name, count: 2, dates: [] };
  const { container } = render(<PeopleBubbles people={people} selected={people[0].name} onSelect={select} connections={[connection]} network />);
  bounds();
  const bubble = screen.getByRole('button', { name: `${people[0].name}: ${people[0].count} entradas` });
  fireEvent.pointerDown(bubble, { pointerId: 1, button: 0, clientX: 300, clientY: 185 });
  fireEvent.pointerUp(bubble, { pointerId: 1 });
  fireEvent.click(bubble, { detail: 1 });
  expect(select).toHaveBeenCalledWith(people[0].name);
  const endpoint = container.querySelector('svg[aria-label="Conexiones entre personas"] line')!.getAttribute('x1');
  fireEvent.keyDown(bubble, { key: 'ArrowRight' });
  expect(container.querySelector('svg[aria-label="Conexiones entre personas"] line')!.getAttribute('x1')).not.toBe(endpoint);
});
it('does not reuse positions from another group or period', () => {
  const { rerender } = render(<PeopleBubbles people={[person]} selected={person.name} onSelect={() => {}} />);
  const bubble = screen.getByRole('button', { name: `${person.name}: ${person.count} entradas` });
  const original = bubble.style.left;
  fireEvent.keyDown(bubble, { key: 'ArrowRight' });
  expect(bubble.style.left).not.toBe(original);
  const changed = { ...person, count: person.count + 1 };
  rerender(<PeopleBubbles people={[changed]} selected={person.name} onSelect={() => {}} />);
  expect(screen.getByRole('button', { name: `${person.name}: ${changed.count} entradas` }).style.left).toBe(original);
});
