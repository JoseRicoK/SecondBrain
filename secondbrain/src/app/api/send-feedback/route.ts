import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getRequestUser } from '@/lib/api-auth';

interface FeedbackRequest {
  type: 'suggestion' | 'problem';
  message: string;
  userEmail: string;
}

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] || character));

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body: FeedbackRequest = await request.json();
    const { type, message, userEmail } = body;

    // Validar los datos recibidos
    if (!['suggestion', 'problem'].includes(type) || typeof message !== 'string' || !message.trim() || message.length > 5000 || typeof userEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Validar que la API key esté configurada
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_placeholder_get_from_resend_dashboard') {
      console.error('❌ RESEND: API key no configurada');
      return NextResponse.json(
        { error: 'Servicio de correo no configurado' },
        { status: 500 }
      );
    }

    // Configurar el email
    const emailSubject = type === 'suggestion' 
      ? '💡 Nueva Sugerencia - SecondBrain'
      : '🐛 Reporte de Problema - SecondBrain';
    const safeEmail = escapeHtml(userEmail);
    const safeMessage = escapeHtml(message.trim());
    const sentAt = new Date().toLocaleString('es-ES');
      
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${emailSubject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;">
          ${type === 'suggestion' ? '💡' : '🐛'} 
          ${type === 'suggestion' ? 'Nueva Sugerencia' : 'Reporte de Problema'}
        </h2>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <p><strong>De:</strong> ${safeEmail}</p>
        <p><strong>Fecha:</strong> ${sentAt}</p>
        <p><strong>Tipo:</strong> ${type === 'suggestion' ? 'Sugerencia' : 'Problema reportado'}</p>
      </div>
      
      <div style="background: white; padding: 20px; border-left: 4px solid ${type === 'suggestion' ? '#4CAF50' : '#f44336'}; margin-bottom: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <h3 style="margin-top: 0; color: #333;">Mensaje:</h3>
        <p style="line-height: 1.6; color: #555; white-space: pre-wrap;">${safeMessage}</p>
      </div>
      
      <div style="text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
        <p>Enviado desde SecondBrain App</p>
        <p>Fecha del sistema: ${new Date().toLocaleString('es-ES')}</p>
      </div>
    </body>
    </html>
    `;

    // Enviar el email usando Resend
    const { data, error } = await resend.emails.send({
      from: 'SecondBrain <feedback@secondbrainapp.com>',
      to: ['josemariark@gmail.com'],
      subject: emailSubject,
      html: emailHtml,
      replyTo: userEmail, // Para poder responder directamente al usuario
    });

    if (error) {
      console.error('❌ RESEND: Error al enviar correo:', error);
      return NextResponse.json(
        { error: 'Error al enviar el correo' },
        { status: 500 }
      );
    }

    console.log('✅ RESEND: Correo enviado exitosamente:', data?.id);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Mensaje enviado correctamente',
      emailId: data?.id 
    });

  } catch (error) {
    console.error('❌ SEND-FEEDBACK: Error general:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
