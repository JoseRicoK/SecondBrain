import { authenticatedFetch } from './authenticated-fetch';
import { MAX_TRANSCRIPTION_BYTES } from './audio-recording';

export function recordingFilename(type: string) {
  const extensions: Record<string, string> = {
    'audio/webm': 'webm', 'video/webm': 'webm', 'audio/wav': 'wav',
    'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'video/mp4': 'mp4',
    'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
  };
  return `recording.${extensions[type.split(';')[0].toLowerCase()] || 'webm'}`;
}

export async function transcribeAudio(audio: Blob) {
  if (audio.size > MAX_TRANSCRIPTION_BYTES) {
    throw new Error('El audio es demasiado grande para enviarlo. Tu grabación se conserva: descárgala antes de salir.');
  }
  const form = new FormData();
  form.append('file', audio, recordingFilename(audio.type));
  const response = await authenticatedFetch('/api/transcribe', {
    method: 'POST', body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string'
      ? data.error : 'No se pudo transcribir el audio. Inténtalo de nuevo.');
  }
  if (typeof data?.text !== 'string' || !data.text.trim() || typeof data.audioUrl !== 'string') {
    throw new Error('No se recibió una transcripción válida. Inténtalo de nuevo.');
  }
  return data as { text: string; audioUrl: string };
}
