import { NextRequest, NextResponse } from "next/server";
import {
  updateUserSubscription,
  getUserProfile,
} from "@/lib/subscription-operations";
import { getRequestUser } from "@/lib/api-auth";
import { stripePeriodEnd, stripeObjectId } from "@/lib/stripe-billing";
import { getStripeClient } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { userId } = await req.json();
    if (user.uid !== userId)
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });

    if (!userId) {
      return NextResponse.json(
        { error: "User ID es requerido" },
        { status: 400 },
      );
    }

    // Obtener la suscripción actual del usuario
    const userProfile = await getUserProfile(userId);

    if (!userProfile) {
      return NextResponse.json(
        { error: "No se encontró usuario" },
        { status: 404 },
      );
    }

    const userSubscription = userProfile.subscription;

    if (userSubscription.plan === "free") {
      return NextResponse.json(
        { error: "El plan gratuito no requiere cancelación" },
        { status: 400 },
      );
    }

    let currentPeriodEndDate: Date;

    // Si no hay stripeSubscriptionId, es entorno de desarrollo
    if (!userSubscription.stripeSubscriptionId) {
      if (
        !userSubscription.currentPeriodEnd ||
        new Date(userSubscription.currentPeriodEnd) <= new Date()
      ) {
        return NextResponse.json(
          { error: "No existe un período de pago vigente que cancelar" },
          { status: 409 },
        );
      }
      currentPeriodEndDate = new Date(userSubscription.currentPeriodEnd);
    } else {
      const stripe = getStripeClient();
      if (!stripe)
        return NextResponse.json(
          { error: "Stripe no está configurado" },
          { status: 503 },
        );
      const existing = await stripe.subscriptions.retrieve(
        userSubscription.stripeSubscriptionId,
      );
      if (
        stripeObjectId(existing.customer) !==
          userSubscription.stripeCustomerId ||
        (existing.metadata.uid && existing.metadata.uid !== user.uid)
      )
        return NextResponse.json(
          { error: "Subscription owner mismatch" },
          { status: 403 },
        );
      // Intentar cancelar en Stripe si tenemos una suscripción real
      try {
        const canceledSubscription = await stripe.subscriptions.update(
          userSubscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          },
        );

        currentPeriodEndDate = stripePeriodEnd(canceledSubscription);
      } catch (stripeError) {
        console.error(
          "❌ [Cancel Subscription] Error con Stripe:",
          stripeError,
        );
        return NextResponse.json(
          {
            error:
              "No se pudo confirmar la cancelación en Stripe. Inténtalo de nuevo.",
          },
          { status: 502 },
        );
      }
    }

    // Verificar que la fecha sea válida
    if (!currentPeriodEndDate || isNaN(currentPeriodEndDate.getTime())) {
      return NextResponse.json(
        { error: "No se pudo confirmar la fecha de cancelación" },
        { status: 502 },
      );
    }

    // Actualizar en Supabase que está marcada para cancelación
    await updateUserSubscription(userId, {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: currentPeriodEndDate,
    });

    return NextResponse.json({
      success: true,
      message:
        "Suscripción programada para cancelación al final del período actual",
      cancelAt: currentPeriodEndDate,
    });
  } catch (error) {
    console.error("❌ [Cancel Subscription] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
