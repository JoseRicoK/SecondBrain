import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '@/lib/subscription-operations';
import { getRequestUser } from '@/lib/api-auth';

async function status(req: NextRequest, userId: string | null) {
  try {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (userId !== user.uid) return NextResponse.json({ error: 'User mismatch' }, { status: 403 });

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      subscription: userProfile.subscription,
      isFirstLogin: userProfile.isFirstLogin
    });
  } catch (error) {
    console.error('❌ [Subscription Check] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return status(req, new URL(req.url).searchParams.get('userId'));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return status(req, body.userId || null);
}
