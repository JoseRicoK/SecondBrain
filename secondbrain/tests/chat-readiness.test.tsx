// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import PersonalChat from "@/components/PersonalChat";
import PersonChat from "@/components/PersonChat";

const mock = vi.hoisted(() => ({
  subscription: vi.fn(),
  check: vi.fn(),
  refresh: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: mock.subscription,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { uid: "u", displayName: "Ana", getIdToken: mock.token },
  }),
}));
let loading: boolean;
let usage: { personalChatMessages: number; personChatMessages: number } | null;
beforeEach(() => {
  loading = true;
  usage = null;
  mock.check.mockReset().mockResolvedValue(true);
  mock.refresh.mockReset().mockResolvedValue(undefined);
  mock.token.mockReset().mockResolvedValue("fixture-token");
  mock.subscription.mockImplementation(() => ({
    loading,
    monthlyUsage: usage,
    planLimits: { personalChatMessages: 5, personChatMessages: 10 },
    checkCanSendPersonalChatMessage: mock.check,
    checkCanSendPersonChatMessage: mock.check,
    refreshMonthlyUsage: mock.refresh,
  }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});
const chat = (kind: string) =>
  kind === "personal" ? (
    <PersonalChat
      userId="u"
      isOpen
      isMinimized={false}
      onClose={vi.fn()}
      onToggleMinimize={vi.fn()}
    />
  ) : (
    <PersonChat
      person={{ id: "p", user_id: "u", name: "Ana", details: {} } as any}
      isOpen
      onClose={vi.fn()}
    />
  );

it.each(["personal", "person"])(
  "%s chat waits for quota loading without displaying a limit error",
  (kind) => {
    render(chat(kind));
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Enviar mensaje" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando cuota");
    expect(screen.queryByText(/Has alcanzado el límite/)).toBeNull();
    expect(mock.check).not.toHaveBeenCalled();
  },
);
it.each(["personal", "person"])(
  "%s chat becomes usable after quota resolves and sends the message",
  async (kind) => {
    const send = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ response: "Respuesta válida" })),
      );
    vi.stubGlobal("fetch", send);
    const view = render(chat(kind));
    loading = false;
    usage = { personalChatMessages: 0, personChatMessages: 0 };
    view.rerender(chat(kind));
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Respuesta válida")).toBeVisible();
    expect(mock.check).toHaveBeenCalledTimes(1);
  },
);
it.each(["personal", "person"])(
  "%s chat distinguishes an unavailable quota from an exhausted quota",
  async (kind) => {
    loading = false;
    render(chat(kind));
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(screen.getByText(/No se pudo comprobar tu cuota/)).toBeVisible();
    expect(screen.queryByText(/Has alcanzado el límite/)).toBeNull();
    expect(mock.check).not.toHaveBeenCalled();
  },
);
it.each(["personal", "person"])(
  "%s chat still enforces a loaded exhausted quota",
  async (kind) => {
    loading = false;
    usage = { personalChatMessages: 5, personChatMessages: 10 };
    mock.check.mockResolvedValue(false);
    render(chat(kind));
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(await screen.findByText(/Has alcanzado el límite/)).toBeVisible();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  },
);
