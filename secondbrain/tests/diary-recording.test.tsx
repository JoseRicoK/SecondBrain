// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import Home from '@/app/page';

const mock = vi.hoisted(() => ({ transcribe: vi.fn(), save: vi.fn(), fetch: vi.fn(), stop: vi.fn(), revoke: vi.fn(), date: '2026-10-01' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u' }, loading: false }) }));
vi.mock('@/lib/store', () => ({ useDiaryStore: () => ({
  currentDate: mock.date, currentEntry: null, isLoading: false, error: null,
  isEditing: true, saveCurrentEntry: mock.save, fetchCurrentEntry: mock.fetch, toggleEditMode: vi.fn(),
}) }));
vi.mock('@/lib/transcription-client', async (original) => ({ ...await original<object>(), transcribeAudio: mock.transcribe }));
vi.mock('@/components/Sidebar', () => ({ default: () => null }));
vi.mock('@/components/PersonalChat', () => ({ default: () => null }));
vi.mock('@/components/PersonalChatButton', () => ({ default: () => null }));
vi.mock('@/components/Auth', () => ({ default: () => null }));
vi.mock('@/components/Loading', () => ({ default: () => null }));
vi.mock('@/components/Settings', () => ({ default: () => null }));
vi.mock('@/components/StatisticsWrapper', () => ({ default: () => null }));
vi.mock('@/components/PeopleManager', () => ({ default: () => null }));
vi.mock('next/image', () => ({ default: (props: any) => <img alt={props.alt} /> }));
class Recorder {
  state = 'inactive'; mimeType = 'audio/webm;codecs=opus';
  ondataavailable: any; onstop: any;
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2000)]) });
    this.onstop?.();
  }
}
beforeEach(() => {
  mock.date = '2026-10-01';
  mock.transcribe.mockReset().mockRejectedValue(new Error('El servicio de IA no tiene saldo.'));
  mock.save.mockReset().mockResolvedValue(undefined);
  mock.stop.mockReset(); mock.revoke.mockReset();
  vi.stubGlobal('MediaRecorder', Recorder);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: mock.stop }] }),
  } });
  URL.createObjectURL = vi.fn().mockReturnValue('blob:recording');
  URL.revokeObjectURL = mock.revoke;
});
async function record() {
  const user = userEvent.setup();
  await user.click(screen.getByTitle('Iniciar grabación'));
  await user.click(screen.getByTitle('Detener grabación'));
  return user;
}
it('keeps failed audio, shows the API reason and retries only on an explicit click', async () => {
  render(<Home />);
  const user = await record();
  expect(await screen.findByRole('alert')).toHaveTextContent('no tiene saldo');
  expect(mock.transcribe).toHaveBeenCalledTimes(1);
  expect(mock.stop).toHaveBeenCalledOnce();
  expect(screen.getByRole('link', { name: 'Descargar grabación' })).toHaveAttribute('download', 'recording.webm');
  mock.transcribe.mockResolvedValue({ text: 'Una entrada ficticia.', audioUrl: 'data:audio/webm;base64,AA==' });
  await user.click(screen.getByRole('button', { name: 'Reintentar transcripción' }));
  await waitFor(() => expect(mock.save).toHaveBeenCalledWith('Una entrada ficticia.', 'u', []));
  expect(mock.transcribe).toHaveBeenCalledTimes(2);
  expect(mock.transcribe.mock.calls[1][0]).toBe(mock.transcribe.mock.calls[0][0]);
  expect(screen.queryByRole('button', { name: 'Reintentar transcripción' })).toBeNull();
  expect(mock.revoke).toHaveBeenCalledWith('blob:recording');
});
it('can discard the failed recording without saving or retrying', async () => {
  render(<Home />);
  const user = await record();
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Descartar grabación' }));
  expect(mock.transcribe).toHaveBeenCalledTimes(1);
  expect(mock.save).not.toHaveBeenCalled();
  expect(screen.getByTitle('Iniciar grabación')).toBeEnabled();
});
it('does not apply a delayed transcription to another diary date', async () => {
  let resolve!: (value: any) => void;
  mock.transcribe.mockReturnValue(new Promise(r => { resolve = r; }));
  const { rerender } = render(<Home />);
  await record();
  mock.date = '2026-10-02';
  rerender(<Home />);
  await act(async () => resolve({ text: 'Texto de la fecha anterior.', audioUrl: 'url' }));
  expect(mock.save).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Reintentar transcripción' })).toBeNull();
});
