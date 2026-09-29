import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionSnapshot } from "@/lib/subscription-snapshot";
import { getRequestUser } from "@/lib/api-auth";

async function status(req: NextRequest, userId: string | null) {
  try {
    const user = await getRequestUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (userId !== user.uid)
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 },
      );
    }

    return NextResponse.json(await getSubscriptionSnapshot(user.uid), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Profile not found")
      return NextResponse.json({ error: error.message }, { status: 404 });
    console.error("❌ [Subscription Check] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return status(req, new URL(req.url).searchParams.get("userId"));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return status(req, body.userId || null);
}
