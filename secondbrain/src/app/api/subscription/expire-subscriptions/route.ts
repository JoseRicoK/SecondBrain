import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const database = getDatabaseClient();
    const { data, error } = await database.from('profiles').select('uid, subscription').eq('subscription->>cancelAtPeriodEnd', 'true').eq('subscription->>status', 'active');
    if (error) throw error;
    let expired = 0;
    for (const profile of data || []) {
      const subscription = profile.subscription as Record<string, unknown>;
      if (subscription.currentPeriodEnd && new Date(String(subscription.currentPeriodEnd)) <= new Date()) {
        await database.from('profiles').update({ subscription: { ...subscription, plan: 'free', status: 'canceled', cancelAtPeriodEnd: false, stripeCustomerId: null, stripeSubscriptionId: null, updatedAt: new Date().toISOString() } }).eq('uid', profile.uid);
        expired++;
      }
    }
    return NextResponse.json({ success: true, processed: data?.length || 0, expired, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
