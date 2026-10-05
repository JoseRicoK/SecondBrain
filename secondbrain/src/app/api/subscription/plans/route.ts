import { PLAN_PRICING } from "@/lib/plan-pricing";
import { hasBillingSchema } from "@/lib/billing-readiness";
import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/lib/supabase";
import { isCheckoutEnabled } from "@/lib/stripe-server";

export async function GET() {
  try {
    const { data, error } = await getDatabaseClient()
      .from("subscription_plans")
      .select("*");
    if (error) throw error;
    const limits = Object.fromEntries(
      (data || []).map((plan) => [
        plan.id,
        {
          personalChatMessages: plan.personal_chat_messages,
          personChatMessages: plan.person_chat_messages,
          statisticsAccess: plan.statistics_access,
        },
      ]),
    );
    const planIds = {
      limits,
      prices: Object.fromEntries(
        Object.entries(PLAN_PRICING.amounts).map(([id, cents]) => [
          id,
          cents / 100,
        ]),
      ),
      currency: PLAN_PRICING.currency,
      interval: PLAN_PRICING.interval,
      free: null,
      pro: process.env.STRIPE_PRO_PRICE_ID || null,
      elite: process.env.STRIPE_ELITE_PRICE_ID || null,
      checkoutEnabled: isCheckoutEnabled() && (await hasBillingSchema()),
    };

    return NextResponse.json(planIds, {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Error al obtener plan IDs:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
