// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLAN_LIMITS } from "@/lib/subscription-policy";
const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
  uid: "u",
  subscription: {} as any,
}));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: mock.uid } }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mock.subscription,
}));
vi.mock("recharts", async () => {
  const React = await import("react");
  const passthrough = ({ children }: any) =>
    React.createElement("div", null, children);
  return Object.fromEntries(
    [
      "ResponsiveContainer",
      "ComposedChart",
      "BarChart",
      "Area",
      "Bar",
      "CartesianGrid",
      "Tooltip",
      "XAxis",
      "YAxis",
    ].map((k) => [k, passthrough]),
  );
});
import Statistics from "@/components/Statistics";
import { PREVIEW_ANALYTICS } from "@/components/statistics/preview-data";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
beforeEach(() => {
  mock.uid = "u";
  mock.fetch.mockReset();
  mock.refresh.mockReset();
  mock.subscription = {
    currentPlan: "pro",
    planLimits: PLAN_LIMITS.pro,
    monthlyUsage: { statisticsAccess: 2 },
    loading: false,
    error: null,
    refreshMonthlyUsage: mock.refresh,
  };
  mock.fetch.mockResolvedValue(
    json({ analytics: PREVIEW_ANALYTICS, report: null }),
  );
});
it("free preview renders blurred examples and a real upgrade link without any API calls", () => {
  mock.subscription.currentPlan = "free";
  mock.subscription.planLimits = PLAN_LIMITS.free;
  const view = render(<Statistics userId="u" />);
  expect(screen.getByRole("link", { name: /Mejorar mi plan/ })).toHaveAttribute(
    "href",
    "/subscription",
  );
  expect(mock.fetch).not.toHaveBeenCalled();
  const backdrop = view.container.querySelector("[inert]");
  expect(backdrop).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByRole("button", { name: /Laura: 15/ })).toBeNull();
});
it("unknown or failed subscription never fetches or masquerades as a free plan", () => {
  mock.subscription.loading = true;
  mock.subscription.monthlyUsage = null;
  const view = render(<Statistics userId="u" />);
  expect(screen.getByRole("status")).toHaveTextContent("Comprobando");
  expect(mock.fetch).not.toHaveBeenCalled();
  mock.subscription.loading = false;
  mock.subscription.error = "Network";
  view.rerender(<Statistics userId="u" />);
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo comprobar");
  expect(screen.queryByRole("link", { name: /Mejorar/ })).toBeNull();
});
it("paid graphs load once; switching periods never generates or charges a report", async () => {
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  expect(mock.fetch.mock.calls[0][0]).toBe(
    "/api/statistics/analytics?period=all",
  );
  await userEvent.setup().selectOptions(screen.getByRole("combobox"), "30");
  await waitFor(() => expect(mock.fetch).toHaveBeenCalledTimes(2));
  expect(mock.fetch.mock.calls[1][0]).toBe(
    "/api/statistics/analytics?period=30",
  );
  expect(mock.refresh).not.toHaveBeenCalled();
});
it("explicit AI generation refreshes usage and preserves independent graphs", async () => {
  const user = userEvent.setup();
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  mock.fetch.mockResolvedValueOnce(
    json({
      weekSummary: "Mi resumen",
      instagramQuote: "Mi cita",
      generatedAt: "2026-10-01T12:00:00Z",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Generar informe semanal" }),
  );
  await screen.findByText("Mi resumen");
  expect(mock.fetch.mock.calls[1]).toEqual([
    "/api/statistics/report",
    expect.objectContaining({ method: "POST", body: '{"refresh":true}' }),
  ]);
  expect(mock.refresh).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("heading", { name: "Las personas de tu historia" }),
  ).toBeVisible();
});
it("exhausted report quota disables AI but continues to show paid charts", async () => {
  mock.subscription.monthlyUsage.statisticsAccess = 10;
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Cómo has ido sintiéndote" });
  expect(
    screen.getByRole("button", { name: "Generar informe semanal" }),
  ).toBeDisabled();
  expect(screen.queryByText("Vista previa · datos de ejemplo")).toBeNull();
});
it("server quota rejection leaves charts usable and shows safe inline error", async () => {
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  mock.fetch.mockResolvedValueOnce(
    json({ error: "Límite mensual de informes" }, 429),
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Generar informe semanal" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Límite mensual");
  expect(
    screen.getByRole("heading", { name: "Las personas de tu historia" }),
  ).toBeVisible();
});
it("obsolete period response is ignored after a newer selection", async () => {
  let finish: (v: Response) => void = () => {};
  mock.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Statistics userId="u" />);
  await userEvent.setup().selectOptions(screen.getByRole("combobox"), "30");
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  await act(async () =>
    finish(
      json({
        analytics: { ...PREVIEW_ANALYTICS, entryCount: 9999 },
        report: null,
      }),
    ),
  );
  expect(screen.queryByText("9999")).toBeNull();
});
it("downgrading removes personal charts and ignores late report replies", async () => {
  let finish: (v: Response) => void = () => {};
  const view = render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  mock.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Generar informe semanal" }));
  mock.subscription = {
    ...mock.subscription,
    currentPlan: "free",
    planLimits: PLAN_LIMITS.free,
  };
  view.rerender(<Statistics userId="u" />);
  await act(async () =>
    finish(
      json({ weekSummary: "Private late report", instagramQuote: "Secret" }),
    ),
  );
  expect(screen.queryByText("Private late report")).toBeNull();
  expect(mock.refresh).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: /Mejorar mi plan/ })).toBeVisible();
});
it("selecting a person, opening a mention and a profile uses concrete callbacks", async () => {
  const onOpenEntry = vi.fn(),
    onOpenPerson = vi.fn();
  render(
    <Statistics
      userId="u"
      onOpenEntry={onOpenEntry}
      onOpenPerson={onOpenPerson}
    />,
  );
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Marcos: 9 entradas" }));
  expect(screen.getByRole("heading", { name: "Marcos" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Ver ficha de Marcos" }));
  expect(onOpenPerson).toHaveBeenCalledWith("Marcos");
  await user.click(screen.getByRole("button", { name: /^1 oct 2026 ·/ }));
  expect(onOpenEntry).toHaveBeenCalledWith("2026-10-01");
});
it("person search handles accents and emotional values are available in an accessible table", async () => {
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: "Buscar una persona en estadísticas" }),
    "mama",
  );
  expect(screen.getByRole("heading", { name: "Mamá" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Laura: 15 entradas" }),
  ).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Ver datos emocionales" }),
  );
  expect(screen.getByRole("table")).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "Felicidad" })).toBeVisible();
});
it("late graph replies cannot populate a different account", async () => {
  let finish: (v: Response) => void = () => {};
  mock.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<Statistics userId="u" />);
  mock.uid = "other";
  mock.fetch.mockResolvedValue(
    json({ analytics: { ...PREVIEW_ANALYTICS, people: [] }, report: null }),
  );
  view.rerender(<Statistics userId="other" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  await act(async () =>
    finish(
      json({
        analytics: PREVIEW_ANALYTICS,
        report: {
          weekSummary: "Previous owner private report",
          instagramQuote: "secret",
          generatedAt: "2026-10-01T12:00:00Z",
        },
      }),
    ),
  );
  expect(screen.queryByText("Previous owner private report")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Laura: 15 entradas" }),
  ).toBeNull();
});

it("removes KPI, rhythm and name list; all people remain reachable only through paged bubbles", async () => {
  const people = Array.from({ length: 25 }, (_, i) => ({
    ...PREVIEW_ANALYTICS.people[0],
    name: `Persona ${i}`,
  }));
  mock.fetch.mockResolvedValue(
    json({ analytics: { ...PREVIEW_ANALYTICS, people }, report: null }),
  );
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "El color de tus días" });
  for (const text of [
    "Mejor racha del periodo",
    "Palabras escritas",
    "Días con una entrada",
    "Cuándo vuelves a tu diario",
    "Ver todas las personas",
  ])
    expect(screen.queryByText(text)).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Siguiente grupo" }));
  await user.click(screen.getByRole("button", { name: "Siguiente grupo" }));
  expect(
    screen.getByRole("button", { name: "Persona 24: 15 entradas" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Siguiente grupo" }),
  ).toBeDisabled();
  await user.type(
    screen.getByRole("textbox", { name: "Buscar una persona en estadísticas" }),
    "Persona 0",
  );
  expect(
    screen.getByRole("button", { name: "Persona 0: 15 entradas" }),
  ).toBeVisible();
});

it("moves emotion buttons into the person card and fetches sorted entries only on demand", async () => {
  const open = vi.fn();
  render(<Statistics userId="u" onOpenEntry={open} />);
  await screen.findByRole("region", {
    name: "Emociones en entradas con Laura",
  });
  expect(screen.getByText("12 de 15 entradas analizadas")).toBeVisible();
  expect(screen.queryByText("Últimas entradas donde aparece")).toBeNull();
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  mock.fetch.mockResolvedValueOnce(
    json({
      entries: [
        {
          date: "2020-01-01",
          happiness: 99,
          tranquility: 40,
          stress: 0,
          sadness: null,
        },
        {
          date: "2026-10-01",
          happiness: 80,
          tranquility: 70,
          stress: null,
          sadness: 0,
        },
      ],
      nextCursor: null,
    }),
  );
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: "Ver entradas con Laura por Felicidad",
    }),
  );
  const popup = await screen.findByRole("dialog");
  expect(
    within(popup).getByRole("heading", { name: "Entradas con más felicidad" }),
  ).toBeVisible();
  const dates = within(popup).getAllByRole("button", {
    name: /Abrir entrada con Laura del/,
  });
  expect(dates[0]).toHaveAccessibleName(
    "Abrir entrada con Laura del 1 ene 2020",
  );
  expect(mock.fetch.mock.calls[1][0]).toBe(
    "/api/statistics/person-emotions?person=Laura&period=all&emotion=happiness",
  );
  await user.click(dates[0]);
  expect(open).toHaveBeenCalledWith("2020-01-01");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mock.refresh).not.toHaveBeenCalled();
});
it("changes emotion without accepting the old response and appends the next page once", async () => {
  render(<Statistics userId="u" />);
  await screen.findByRole("region", {
    name: "Emociones en entradas con Laura",
  });
  let finish!: (value: Response) => void;
  mock.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: "Ver entradas con Laura por Felicidad",
    }),
  );
  mock.fetch.mockResolvedValueOnce(
    json({
      entries: [
        {
          date: "2026-10-01",
          happiness: 80,
          tranquility: 99,
          stress: null,
          sadness: 0,
        },
      ],
      nextCursor: "99|2026-10-01",
    }),
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Calma",
      exact: true,
    }),
  );
  await screen.findByRole("button", { name: "Cargar más entradas" });
  await act(async () =>
    finish(
      json({
        entries: [{ date: "2020-01-01", happiness: 100 }],
        nextCursor: null,
      }),
    ),
  );
  expect(
    screen.queryByRole("button", {
      name: /Abrir entrada con Laura del 1 ene 2020/,
    }),
  ).toBeNull();
  mock.fetch.mockResolvedValueOnce(
    json({
      entries: [
        {
          date: "2026-09-29",
          happiness: 40,
          tranquility: 90,
          stress: null,
          sadness: 0,
        },
      ],
      nextCursor: null,
    }),
  );
  await user.click(screen.getByRole("button", { name: "Cargar más entradas" }));
  await screen.findByRole("button", {
    name: /Abrir entrada con Laura del 29 sept 2026/,
  });
  expect(
    within(screen.getByRole("dialog")).getAllByRole("button", {
      name: /Abrir entrada con Laura del/,
    }),
  ).toHaveLength(2);
  expect(mock.fetch.mock.calls.at(-1)?.[0]).toContain(
    "emotion=tranquility&cursor=99%7C2026-10-01",
  );
});
it("shows an inline ranking failure and ignores a response after closing", async () => {
  render(<Statistics userId="u" />);
  await screen.findByRole("region", {
    name: "Emociones en entradas con Laura",
  });
  const user = userEvent.setup();
  mock.fetch.mockResolvedValueOnce(json({}, 500));
  await user.click(
    screen.getByRole("button", {
      name: "Ver entradas con Laura por Felicidad",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudieron cargar las entradas",
  );
  let finish!: (value: Response) => void;
  mock.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(screen.getByRole("button", { name: "Reintentar entradas" }));
  await user.click(
    screen.getByRole("button", { name: "Cerrar entradas por emoción" }),
  );
  await act(async () =>
    finish(
      json({
        entries: [{ date: "2020-01-01", happiness: 100 }],
        nextCursor: null,
      }),
    ),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("loads shared memory excerpts only after selecting a connection, and opens the real entry", async () => {
  const open = vi.fn();
  render(<Statistics userId="u" onOpenEntry={open} />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Conexiones de Laura" }));
  mock.fetch.mockResolvedValueOnce(
    json({
      entries: [
        {
          date: "2026-10-01",
          excerpt: "Un paseo con Laura y Marcos.",
          happiness: 80,
          tranquility: 70,
          stress: null,
          sadness: null,
        },
      ],
    }),
  );
  await userEvent.setup().click(
    screen.getByRole("button", {
      name: "Ver conexión entre Laura y Marcos: 6 entradas",
    }),
  );
  expect(await screen.findByText("Un paseo con Laura y Marcos.")).toBeVisible();
  expect(mock.fetch.mock.calls[1][0]).toContain("/api/statistics/connections?");
  expect(mock.refresh).not.toHaveBeenCalled();
  await userEvent.setup().click(
    screen.getByRole("button", {
      name: "Abrir recuerdo con Laura y Marcos del 1 oct 2026",
    }),
  );
  expect(open).toHaveBeenCalledWith("2026-10-01");
});
it("ignores stale connection replies after closing them or selecting another pair", async () => {
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  let finish!: (value: Response) => void;
  mock.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Conexiones de Laura" }));
  await user.click(
    screen.getByRole("button", {
      name: "Ver conexión entre Laura y Marcos: 6 entradas",
    }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Cargando recuerdos");
  await user.click(
    screen.getByRole("button", { name: "Cerrar recuerdos compartidos" }),
  );
  await act(async () =>
    finish(
      json({
        entries: [
          {
            date: "2026-10-01",
            excerpt: "Old private memory",
            happiness: 80,
            tranquility: null,
            stress: null,
            sadness: null,
          },
        ],
      }),
    ),
  );
  expect(screen.queryByText("Old private memory")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
});
it("connection failures keep graphs and person emotions visible and permit an explicit retry", async () => {
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  mock.fetch.mockResolvedValueOnce(json({}, 500));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Conexiones de Laura" }));
  await user.click(
    screen.getByRole("button", {
      name: "Ver conexión entre Laura y Marcos: 6 entradas",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudieron cargar",
  );
  expect(
    screen.getByRole("region", {
      name: "Emociones en entradas con Laura",
    }),
  ).toBeVisible();
  mock.fetch.mockResolvedValueOnce(json({ entries: [] }));
  await user.click(
    screen.getByRole("button", { name: "Reintentar recuerdos" }),
  );
  expect(
    await screen.findByText(/Estas referencias han cambiado/),
  ).toBeVisible();
});
it("focused connections reach neighbours beyond the normal twelve-person page", async () => {
  const people = Array.from({ length: 25 }, (_, i) => ({
    ...PREVIEW_ANALYTICS.people[0],
    name: `Persona ${i}`,
  }));
  const connections = people.slice(1).map((person, i) => ({
    key: `pair-${i}`,
    source: "Persona 0",
    target: person.name,
    count: 2,
    dates: ["2026-10-01"],
  }));
  mock.fetch.mockResolvedValue(
    json({
      analytics: { ...PREVIEW_ANALYTICS, people, connections },
      report: null,
    }),
  );
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Tu vida, en perspectiva." });
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Conexiones de Persona 0" }),
  );
  await user.click(screen.getByRole("button", { name: "Siguiente grupo" }));
  await user.click(screen.getByRole("button", { name: "Siguiente grupo" }));
  expect(
    screen.getByRole("button", {
      name: "Ver conexión entre Persona 0 y Persona 24: 2 entradas",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Persona 0: 15 entradas" }),
  ).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Persona 24: 15 entradas" }),
  );
  expect(
    screen.getByRole("region", {
      name: "Emociones en entradas con Persona 24",
    }),
  ).toBeVisible();
});

it("refreshes saved graphs on return to the tab, coalesces focus/visibility and cleans up", async () => {
  const view = render(<Statistics userId="u" />);
  await screen.findByRole("heading", { name: "Cómo has ido sintiéndote" });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  expect(mock.fetch.mock.calls[1][1]).toMatchObject({ cache: "no-store" });
  expect(
    mock.fetch.mock.calls.every(([url]) =>
      url.startsWith("/api/statistics/analytics"),
    ),
  ).toBe(true);
  expect(mock.refresh).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(mock.fetch).toHaveBeenCalledTimes(2);
});

it("refreshes the rolling period across Madrid midnight without polling the API every minute", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T21:58:30Z"));
  try {
    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(<Statistics userId="u" />);
    });
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mock.fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mock.fetch).toHaveBeenCalledTimes(2);
    view!.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("a zero sum never invents Neutral 100% and leaves original zeros accessible", async () => {
  const empty = {
    happiness: 0,
    tranquility: 0,
    stress: 0,
    sadness: 0,
    neutral: 0,
  };
  mock.fetch.mockResolvedValue(
    json({
      analytics: {
        ...PREVIEW_ANALYTICS,
        moodSamples: 1,
        averages: empty,
        timeline: [{ ...PREVIEW_ANALYTICS.timeline[0], ...empty, samples: 1 }],
      },
      report: null,
    }),
  );
  render(<Statistics userId="u" />);
  await screen.findByRole("heading", {
    name: "No hay un reparto emocional calculable",
  });
  expect(screen.getByRole("button", { name: /^Neutral/ })).toBeDisabled();
  expect(screen.queryByRole("img", { name: /Reparto emocional/ })).toBeNull();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Ver datos emocionales" }));
  const cells = screen.getByRole("table").querySelectorAll("tbody td");
  expect(Array.from(cells).map((cell) => cell.textContent)).toEqual([
    "0",
    "0",
    "0",
    "0",
    "0",
  ]);
});
