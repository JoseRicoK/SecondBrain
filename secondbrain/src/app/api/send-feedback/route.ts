import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface FeedbackRequest {
  type: 'suggestion' | 'problem';
  message: string;
  userEmail: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();
    const { type, message, userEmail, timestamp } = body;

    // Validar los datos recibidos
    if (!type || !message || !userEmail) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Configurar el transportador de correo
    // Necesitarás configurar estas variables de entorno
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD, // App password de Gmail
      },
    });

    // Configurar el email
    const emailSubject = type === 'suggestion' 
      ? '💡 Nueva Sugerencia - SecondBrain'
      : '🐛 Reporte de Problema - SecondBrain';
      
    const emailText = `
${type === 'suggestion' ? 'NUEVA SUGERENCIA' : 'REPORTE DE PROBLEMA'}

De: ${userEmail}
Fecha: ${new Date(timestamp).toLocaleString('es-ES')}

Mensaje:
${message}

---
Enviado desde SecondBrain App
    `.trim();

    const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin-bottom: 20px;">
    <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;">
      ${type === 'suggestion' ? '💡' : '🐛'} 
      ${type === 'suggestion' ? 'Nueva Sugerencia' : 'Reporte de Problema'}
    </h2>
  </div>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
    <p><strong>De:</strong> ${userEmail}</p>
    <p><strong>Fecha:</strong> ${new Date(timestamp).toLocaleString('es-ES')}</p>
  </div>
  
  <div style="background: white; padding: 20px; border-left: 4px solid ${type === 'suggestion' ? '#4CAF50' : '#f44336'}; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #333;">Mensaje:</h3>
    <p style="line-height: 1.6; color: #555;">${message.replace(/\n/g, '<br>')}</p>
  </div>
  
  <div style="text-align: center; color: #666; font-size: 12px;">
    <p>Enviado desde SecondBrain App</p>
  </div>
</div>
    `;

    // Enviar el email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'josemariark@gmail.com',
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Mensaje enviado correctamente' 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
