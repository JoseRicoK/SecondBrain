import { getUserProfile } from "@/lib/subscription-operations";
import { closeAccountBilling } from "@/lib/account-billing";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getDatabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getAuthenticatedUser(token);
  if (!user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const profile = await getUserProfile(user.uid);
    await closeAccountBilling(user.uid, profile?.subscription);
    const { error } = await getDatabaseClient().auth.admin.deleteUser(user.uid);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la cuenta",
      },
      { status: 500 },
    );
  }
}
