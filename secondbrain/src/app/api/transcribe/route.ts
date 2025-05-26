import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Verificar la clave API de OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Procesar el formulario con el archivo de audio
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    const entryId = formData.get('entryId') as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    if (!entryId) {
      return NextResponse.json(
        { error: 'No entry ID provided' },
        { status: 400 }
      );
    }

    // Convertir File a Buffer para enviarlo a OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Subir el archivo a Supabase Storage
    const fileName = `audio-${Date.now()}.wav`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('audio-recordings')
      .upload(`public/${fileName}`, buffer, {
        contentType: 'audio/wav',
      });
    
    if (storageError) {
      console.error('Error al subir audio a Supabase:', storageError);
      return NextResponse.json(
        { error: 'Error uploading audio file' },
        { status: 500 }
      );
    }
    
    // Obtener la URL pública del archivo
    const { data: publicUrl } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(`public/${fileName}`);
    
    // Crear un archivo temporal para la transcripción
    const tempFileName = `whisper-${Date.now()}.wav`;
    const transcriptionFile = new File([buffer], tempFileName, { type: 'audio/wav' });
    
    // Llamar a la API de Whisper
    const response = await openai.audio.transcriptions.create({
      file: transcriptionFile,
      model: 'whisper-1',
      language: 'es',
      response_format: 'json'
    });

    // Extraer el texto transcrito
    const transcription = response.text;

    return NextResponse.json({
      text: transcription,
      audioUrl: publicUrl.publicUrl
    });
    
  } catch (error: any) {
    console.error('Error processing audio:', error);
    
    return NextResponse.json(
      { error: error.message || 'Error processing audio' },
      { status: 500 }
    );
  }
}
