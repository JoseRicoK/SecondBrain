// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import AudioRecorder from "@/components/AudioRecorder";
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  refresh: vi.fn(),
  session: vi.fn(),
  trackStop: vi.fn(),
  media: vi.fn(),
  url: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@/lib/store", () => ({
  useDiaryStore: () => ({
    currentEntry: { id: "e" },
    fetchTranscriptions: mock.refresh,
  }),
}));
vi.mock("@/lib/supabase-operations", () => ({
  saveAudioTranscription: mock.save,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: mock.session } },
}));
let recorder: any;
class Recorder {
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  onstop: any;
  ondataavailable: any;
  constructor() {
    recorder = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2000)]) });
    this.onstop?.();
  }
}
beforeEach(() => {
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.media.mockResolvedValue({ getTracks: () => [{ stop: mock.trackStop }] });
  mock.session.mockResolvedValue({ data: { session: { access_token: "t" } } });
  mock.save.mockResolvedValue({ id: "a" });
  mock.url.mockReturnValue("blob:fixture");
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("URL", {
    createObjectURL: mock.url,
    revokeObjectURL: mock.revoke,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: mock.media },
    configurable: true,
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
const record = async () => {
  const u = userEvent.setup();
  await u.click(screen.getByTitle("Iniciar grabación"));
  await u.click(screen.getByTitle("Detener grabación"));
  return u;
};
it("preserves the browser's actual recording format in the audio preview", async () => {
  render(<AudioRecorder />);
  await record();
  await waitFor(() => expect(mock.url).toHaveBeenCalled());
  expect(mock.url.mock.calls[0][0].type).toBe("audio/webm;codecs=opus");
});
it("microphone rejection is visible without starting a recorder", async () => {
  mock.media.mockRejectedValue(new Error("denied"));
  render(<AudioRecorder />);
  await userEvent.setup().click(screen.getByTitle("Iniciar grabación"));
  expect(
    await screen.findByText(/No se pudo acceder al micrófono/),
  ).toBeVisible();
});
it("recording stops all microphone tracks and supports playback", async () => {
  render(<AudioRecorder />);
  const u = await record();
  expect(mock.trackStop).toHaveBeenCalledOnce();
  await u.click(screen.getByTitle("Reproducir"));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  await u.click(screen.getByTitle("Pausar"));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
});
it("transcribes, persists audio, refreshes list and clears preview", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('{"text":"Hola","audioUrl":"data:audio/wav;base64,AA=="}'),
  );
  render(<AudioRecorder />);
  const u = await record();
  await u.click(screen.getByRole("button", { name: "Transcribir audio" }));
  await waitFor(() =>
    expect(mock.save).toHaveBeenCalledWith(
      "e",
      "data:audio/wav;base64,AA==",
      "Hola",
    ),
  );
  expect(mock.refresh).toHaveBeenCalled();
  expect(screen.queryByTitle("Reproducir")).toBeNull();
});
it("API failure preserves the recorded audio for retry", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
  render(<AudioRecorder />);
  const u = await record();
  await u.click(screen.getByRole("button", { name: "Transcribir audio" }));
  expect(
    await screen.findByText(/No se pudo transcribir el audio/),
  ).toBeVisible();
  expect(screen.getByTitle("Reproducir")).toBeVisible();
  expect(mock.save).not.toHaveBeenCalled();
});
it("failed persistence keeps the preview and reports an error", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('{"text":"Hola","audioUrl":"url"}'),
  );
  mock.save.mockResolvedValue(null);
  render(<AudioRecorder />);
  const u = await record();
  await u.click(screen.getByRole("button", { name: "Transcribir audio" }));
  expect(
    await screen.findByText(/No se pudo guardar la transcripción/),
  ).toBeVisible();
  expect(mock.refresh).not.toHaveBeenCalled();
  expect(screen.getByTitle("Reproducir")).toBeVisible();
});
it("automatically stops at ten minutes and transcribes all chunks including the final one", async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockResolvedValue(new Response('{"text":"Audio completo","audioUrl":"url"}'));
  render(<AudioRecorder />);
  await act(async () => {
    fireEvent.click(screen.getByTitle("Iniciar grabación"));
  });
  expect(recorder.state).toBe("recording");
  await act(() => {
    vi.advanceTimersByTime(10 * 60 * 1000 - 1);
  });
  expect(recorder.state).toBe("recording");
  recorder.ondataavailable({ data: new Blob([new Uint8Array(1000)]) });
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(recorder.state).toBe("inactive");
  expect(mock.trackStop).toHaveBeenCalledOnce();
  expect(screen.getByRole("status")).toHaveTextContent("10 minutos");
  expect(fetch).toHaveBeenCalledOnce();
  const audio = (vi.mocked(fetch).mock.calls[0][1]?.body as FormData).get("file") as File;
  expect(audio.size).toBe(3000);
  vi.useRealTimers();
  await waitFor(() => expect(mock.save).toHaveBeenCalledWith("e", "url", "Audio completo"));
});
it("unmount stops a running microphone and cleans preview URLs", async () => {
  const { unmount } = render(<AudioRecorder />);
  const u = await record();
  expect(mock.url).toHaveBeenCalled();
  unmount();
  expect(mock.revoke).toHaveBeenCalledWith("blob:fixture");
});
