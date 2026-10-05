import {
  requireDashboardAdmin,
  dashboardJson,
  dashboardFailure,
} from "@/lib/dashboard-auth";
export async function GET(request: Request) {
  try {
    const access = await requireDashboardAdmin(request);
    if (access.response) return access.response;
    const { data, error } = await access.database.rpc("admin_overview", {
      p_actor: access.user.uid,
    });
    if (error || !data) return dashboardFailure(error);
    return dashboardJson({
      ...data,
      checkoutEnabled: process.env.STRIPE_CHECKOUT_ENABLED === "true",
      billingEmailsEnabled: process.env.BILLING_EMAILS_ENABLED === "true",
    });
  } catch {
    return dashboardFailure();
  }
}
