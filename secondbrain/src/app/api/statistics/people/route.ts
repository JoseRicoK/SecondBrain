import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getPeopleByUserId } from '@/lib/firebase-operations';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const user = await getAuthenticatedUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.uid;

    // Obtener personas ordenadas por menciones
    const peopleData = await getPeopleByUserId(userId);
    const topPeople = peopleData
      .map((person: any) => ({
        name: person.name,
        count: person.mention_count || 0
      }))
      .filter((person: any) => person.count > 0)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 20);
    
    return NextResponse.json({ topPeople });

  } catch (error) {
    console.error('Error en API de ranking de personas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al obtener ranking: ${errorMessage}` },
      { status: 500 }
    );
  }
}
