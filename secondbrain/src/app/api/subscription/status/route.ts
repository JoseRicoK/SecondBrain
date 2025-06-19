import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '@/lib/subscription-operations';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

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
