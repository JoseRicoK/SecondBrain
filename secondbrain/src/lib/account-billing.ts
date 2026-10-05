import { getStripeClient } from "./stripe-server";
import type { UserSubscription } from "./subscription-operations";
/** Close open payment sessions and cancel future renewals before removing the account. */
export async function closeAccountBilling(
  uid: string,
  subscription?: UserSubscription,
) {
  const customerId = subscription?.stripeCustomerId;
  if (!customerId) {
    if (subscription?.stripeSubscriptionId)
      throw new Error(
        "No se puede verificar la facturación de esta cuenta. Contacta con soporte.",
      );
    return;
  }
  const stripe = getStripeClient();
  if (!stripe)
    throw new Error(
      "No se puede confirmar la cancelación del pago. Contacta con soporte antes de eliminar la cuenta.",
    );
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;
  if (customer.metadata.uid && customer.metadata.uid !== uid)
    throw new Error("El cliente de facturación no corresponde a esta cuenta.");
  let after: string | undefined;
  do {
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "open",
      limit: 100,
      ...(after ? { starting_after: after } : {}),
    });
    for (const session of sessions.data)
      await stripe.checkout.sessions.expire(session.id);
    after = sessions.has_more ? sessions.data.at(-1)?.id : undefined;
    if (sessions.has_more && !after)
      throw new Error("No se pudo cerrar la facturación pendiente.");
  } while (after);
  // Stripe customer deletion cancels all subscriptions and prevents a concurrent checkout using this customer.
  const removed = await stripe.customers.del(customerId);
  if (!removed.deleted)
    throw new Error("No se pudo confirmar el cierre de la suscripción.");
}
