export async function getAuthenticatedUser(token?: string): Promise<{ uid: string; email?: string } | null> {
  if (!token) return null;
  
  try {
    // Por ahora, usar una verificación simple del token
    // En producción, deberías usar Firebase Admin para verificar el token
    const response = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: token
      })
    });
    
    if (!response.ok) {
      throw new Error('Token inválido');
    }
    
    const data = await response.json();
    const user = data.users?.[0];
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    return {
      uid: user.localId,
      email: user.email
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}
