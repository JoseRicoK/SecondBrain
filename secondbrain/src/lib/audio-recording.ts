export const MAX_RECORDING_SECONDS = 10 * 60;
export const RECORDING_OPTIONS: MediaRecorderOptions = { audioBitsPerSecond: 32_000 };
// Leave room for multipart headers and the base64 audio returned by the API.
export const MAX_TRANSCRIPTION_BYTES = 3 * 1024 * 1024;
export const RECORDING_LIMIT_NOTICE = 'Se han alcanzado los 10 minutos. La grabación se ha detenido y se transcribirá completa.';

export function recordingTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function startLimitedRecording(
  recorder: MediaRecorder,
  onElapsed: (seconds: number) => void,
  onLimit: () => void,
) {
  const startedAt = Date.now();
  let disposed = false;
  let deadline: ReturnType<typeof setTimeout>;
  let ticker: ReturnType<typeof setInterval>;
  const cleanup = () => {
    disposed = true;
    clearTimeout(deadline);
    clearInterval(ticker);
    document.removeEventListener('visibilitychange', update);
  };
  const update = () => {
    if (disposed) return;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    onElapsed(Math.min(elapsed, MAX_RECORDING_SECONDS));
    if (elapsed >= MAX_RECORDING_SECONDS && recorder.state !== 'inactive') {
      cleanup();
      onLimit();
      // stop emits the final dataavailable chunk before onstop. Never slice it.
      recorder.stop();
    }
  };
  recorder.start(1000);
  onElapsed(0);
  deadline = setTimeout(update, MAX_RECORDING_SECONDS * 1000);
  ticker = setInterval(update, 1000);
  document.addEventListener('visibilitychange', update);
  return cleanup;
}
