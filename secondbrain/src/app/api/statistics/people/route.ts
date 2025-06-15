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
    console.log('📊 [Statistics] Datos de personas obtenidos:', peopleData.length);
    console.log('📊 [Statistics] Primeras 3 personas:', peopleData.slice(0, 3).map(p => ({ name: p.name, mention_count: p.mention_count })));
    
    const topPeople = peopleData
      .map((person: { name: string; mention_count?: number }) => ({
        name: person.name,
        count: person.mention_count || 0
      }))
      .filter((person: { count: number }) => person.count > 0)
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, 20);
    
    console.log('📊 [Statistics] Top people calculado:', topPeople.length);
    console.log('📊 [Statistics] Top 5 personas:', topPeople.slice(0, 5));
    
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
