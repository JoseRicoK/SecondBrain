export function validatedBillingUrl(
  value: unknown,
  type: "checkout" | "portal",
): string {
  if (typeof value !== "string") throw new Error("No se pudo iniciar el pago");
  const url = new URL(value);
  const host =
    type === "checkout" ? "checkout.stripe.com" : "billing.stripe.com";
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Dirección de pago no válida");
  return url.href;
}
export function navigateToBilling(value: unknown, type: "checkout" | "portal") {
  window.location.assign(validatedBillingUrl(value, type));
}
