import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('⭐ API: Recibida solicitud de transcripción');

    // Procesar el formulario con el archivo de audio
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
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

    // Convertir File a Buffer para enviarlo a OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    const audioUrl = `data:${audioFile.type};base64,${audioBase64}`;
    
    // Crear un archivo temporal para la transcripción
    const tempFileName = `whisper-${Date.now()}.mp3`; // Cambiamos a .mp3 que funciona mejor con Whisper
    const transcriptionFile = new File([new Uint8Array(arrayBuffer)], tempFileName, { 
      type: 'audio/mpeg' // Forzamos el tipo a MP3 que es mejor soportado
    });
    
    console.log('⭐ API: Enviando audio a Whisper, tamaño:', arrayBuffer.byteLength, 'bytes');
    
    // Usar el modelo más reciente con más opciones para mejor calidad
    const response = await openai.audio.transcriptions.create({
      file: transcriptionFile,
      model: 'whisper-1', // Modelo más reciente de Whisper
      language: 'es', // Especificamos español
      prompt: 'Transcribe literalmente lo que se dice en español', // Prompt para guiar la transcripción
      temperature: 0.0, // Menor temperatura para transcripción más precisa
      response_format: 'json'
    });

    // Extraer el texto transcrito
    const transcription = response.text;
    console.log('✅ API: Transcripción completada:', transcription);

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
    console.error('❌ API: Error processing audio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage || 'Error processing audio' },
      { status: 500 }
    );
  }
}
