import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json(
        { error: 'No se proporcionó texto para estilizar' },
        { status: 400 }
      );
    }

    const prompt = `
      Eres un asistente especializado en mejorar y estilizar entradas de diario. 
      Tu tarea es tomar el texto transcrito de una grabación de voz y convertirlo en una entrada de diario bien escrita y estructurada.
      
      Instrucciones específicas:
      1. Mantén el contenido y las ideas originales, pero mejora la redacción y estructura.
      2. Corrige errores gramaticales y de puntuación.
      3. Organiza el texto en párrafos coherentes si es necesario.
      4. Elimina muletillas, repeticiones y palabras de relleno típicas del habla.
      5. Mantén un tono personal y auténtico, como si fuera un diario real.
      6. No añadas información que no esté en el texto original.
      7. Respeta el estilo y personalidad del autor.
      
      Texto a estilizar:
      ${text}
      
      Responde SOLO con el texto estilizado, sin comentarios adicionales.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",  // Puedes cambiar esto a gpt-3.5-turbo si prefieres
      messages: [
        { role: "system", content: "Eres un asistente especializado en mejorar y estilizar entradas de diario." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const stylizedText = completion.choices[0].message.content;

    return NextResponse.json({ stylizedText });
  } catch (error: any) {
    console.error('Error al estilizar el texto:', error);
    return NextResponse.json(
      { error: `Error al estilizar el texto: ${error.message}` },
      { status: 500 }
    );
  }
}
