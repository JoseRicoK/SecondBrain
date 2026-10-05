import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AI_MODELS } from '@/lib/ai-models';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { MAX_TRANSCRIPTION_BYTES } from '@/lib/audio-recording';

export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const user = await getAuthenticatedUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar la clave API de OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'El servicio de transcripción no está configurado.', code: 'TRANSCRIPTION_UNAVAILABLE' },
        { status: 503 }
      );
    }

    console.log('⭐ API: Recibida solicitud de transcripción');

    // Procesar el formulario con el archivo de audio
    const formData = await request.formData();
    const audioFile = formData.get('file');

    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('⭐ API: Archivo de audio recibido:', audioFile.name, audioFile.type, audioFile.size, 'bytes');

    if (audioFile.size < 1000) {
      return NextResponse.json(
        { error: 'El archivo de audio es demasiado pequeño. Intenta grabar durante más tiempo.' },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_TRANSCRIPTION_BYTES) {
      return NextResponse.json({ error: 'El audio es demasiado grande para procesarlo. Conserva o descarga la grabación.', code: 'AUDIO_TOO_LARGE' }, { status: 413 });
    }

    // Convertir File a Buffer para enviarlo a OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    const audioUrl = `data:${audioFile.type};base64,${audioBase64}`;
    
    // Preserve the actual container. Renaming WebM/WAV bytes does not convert them.
    const extensions: Record<string, string> = {
      'audio/webm': 'webm', 'video/webm': 'webm',
      'audio/wav': 'wav', 'audio/x-wav': 'wav',
      'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'audio/x-m4a': 'm4a',
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
    };
    const extension = extensions[audioFile.type.split(';')[0].toLowerCase()];
    const transcriptionFile = extension
      ? new File([audioFile], `recording.${extension}`, { type: audioFile.type })
      : audioFile;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 150_000, maxRetries: 0 });
    const response = await openai.audio.transcriptions.create({
      file: transcriptionFile,
      model: AI_MODELS.transcription,
      languages: ['es'],
      prompt: 'Una entrada de diario personal. Conserva los nombres propios y las palabras originales.',
    });

    // Extraer el texto transcrito
    const transcription = response.text;

    if (!transcription || transcription.trim() === '') {
      return NextResponse.json(
        { error: 'La transcripción está vacía. Intenta hablar más cerca del micrófono.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      text: transcription,
      audioUrl
    });
    
  } catch (error) {
    const providerError = error as { code?: string; status?: number; type?: string } | null;
    // Do not log provider headers, credentials or raw response bodies.
    console.warn('Transcription failed', { code: providerError?.code, status: providerError?.status });
    if (providerError?.code === 'credit_balance_exhausted' ||
        providerError?.code === 'insufficient_quota' || providerError?.type === 'insufficient_quota') {
      return NextResponse.json({
        error: 'La transcripción no está disponible porque el servicio de IA no tiene saldo. Es necesario recargar el saldo de OpenAI para continuar.',
        code: 'AI_CREDITS_EXHAUSTED',
      }, { status: 503 });
    }
    if (providerError?.status === 429) {
      return NextResponse.json({ error: 'El servicio de transcripción está ocupado. Inténtalo de nuevo en unos momentos.', code: 'AI_RATE_LIMITED' }, { status: 503 });
    }
    return NextResponse.json(
      { error: 'No se pudo transcribir el audio. Inténtalo de nuevo.', code: 'TRANSCRIPTION_FAILED' },
      { status: 502 }
    );
  }
}
