import PLAN_PRICING from "../shared/plan-pricing.json" with { type: "json" };
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../secondbrain/package.json", import.meta.url),
);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(new URL("../secondbrain", import.meta.url).pathname);
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const remote = process.argv.includes("--remote");
const live = process.argv.includes("--live");
const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });
const required = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_ELITE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
for (const key of required)
  add(
    key,
    Boolean(process.env[key]),
    process.env[key] ? "configured" : "missing",
  );
const key = process.env.STRIPE_SECRET_KEY || "";
const mode = /^(sk|rk)_live_/.test(key)
  ? "live"
  : /^(sk|rk)_test_/.test(key)
    ? "test"
    : "unknown";
add("key mode", mode === (live ? "live" : "test"), mode);
const origin = process.env.APP_BASE_URL || "https://app.lumadiary.com";
try {
  const url = new URL(origin);
  add(
    "canonical billing origin",
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "HTTPS origin required",
  );
} catch {
  add("canonical billing origin", false, "invalid URL");
}
add(
  "distinct plan prices",
  Boolean(process.env.STRIPE_PRO_PRICE_ID) &&
    process.env.STRIPE_PRO_PRICE_ID !== process.env.STRIPE_ELITE_PRICE_ID,
  "Pro and Elite must have separate prices",
);
if (
  remote &&
  required.every((name) => Boolean(process.env[name])) &&
  mode !== "unknown"
) {
  const stripe = new Stripe(key, {
    apiVersion: "2026-08-26.dahlia",
    maxNetworkRetries: 2,
  });
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const inspect = async (name, fn) => {
    try {
      await fn();
    } catch (error) {
      add(
        name,
        false,
        `read-only check failed (${error?.code || error?.type || "unavailable"})`,
      );
    }
  };
  await Promise.allSettled([
    inspect("billing schema", async () => {
      const { data, error } = await db.rpc("billing_schema_version");
      add(
        "billing schema",
        !error && data === 2,
        "requires version 2 migration",
      );
    }),
    inspect("existing billing references", async () => {
      const { data, error } = await db
        .from("subscriptions")
        .select("user_id,stripe_customer_id,stripe_subscription_id")
        .not("stripe_customer_id", "is", null);
      if (error) throw error;
      let valid = true;
      for (const row of data || []) {
        try {
          const customer = await stripe.customers.retrieve(
            row.stripe_customer_id,
          );
          if (
            customer.deleted ||
            customer.livemode !== live ||
            (customer.metadata.uid && customer.metadata.uid !== row.user_id)
          ) {
            valid = false;
            continue;
          }
          if (row.stripe_subscription_id) {
            const subscription = await stripe.subscriptions.retrieve(
              row.stripe_subscription_id,
            );
            const owner =
              typeof subscription.customer === "string"
                ? subscription.customer
                : subscription.customer.id;
            if (
              owner !== row.stripe_customer_id ||
              (subscription.metadata.uid &&
                subscription.metadata.uid !== row.user_id)
            )
              valid = false;
          }
        } catch {
          valid = false;
        }
      }
      add(
        "existing billing references",
        valid,
        "all stored references must belong to this account, key mode and user; reconcile obsolete references before activation",
      );
    }),
    inspect("Stripe account", async () => {
      const account = await stripe.accounts.retrieve();
      add(
        "Stripe account",
        !live || (account.charges_enabled && account.details_submitted),
        "live requires charges enabled and account details submitted",
      );
    }),
    ...["pro", "elite"].map((plan) =>
      inspect(`price ${plan}`, async () => {
        const price = await stripe.prices.retrieve(
          process.env[`STRIPE_${plan.toUpperCase()}_PRICE_ID`],
          { expand: ["product"] },
        );
        add(
          `price ${plan}`,
          price.active &&
            price.currency === "eur" &&
            price.unit_amount === PLAN_PRICING.amounts[plan] &&
            price.recurring?.interval === "month" &&
            price.recurring.interval_count === 1 &&
            price.livemode === live &&
            typeof price.product === "object" &&
            !price.product.deleted &&
            price.product.active,
          "active product, EUR, monthly, expected amount and mode",
        );
      }),
    ),
    inspect("signed webhook", async () => {
      const events = [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed",
      ];
      const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
      const endpoint = endpoints.data.find(
        (item) =>
          item.url === origin + "/api/stripe/webhook" &&
          item.status === "enabled" &&
          item.livemode === live,
      );
      add(
        "signed webhook",
        Boolean(
          endpoint &&
          endpoint.api_version === "2026-08-26.dahlia" &&
          events.every(
            (event) =>
              endpoint.enabled_events.includes("*") ||
              endpoint.enabled_events.includes(event),
          ),
        ),
        "matching origin, API version, mode and lifecycle events; signing secret still requires a signed delivery test",
      );
    }),
    inspect("customer portal", async () => {
      const configs = await stripe.billingPortal.configurations.list({
        active: true,
        limit: 100,
      });
      const defaultConfig = configs.data.find(
        (item) => item.is_default && item.livemode === live,
      );
      // Stripe omits the allowed products unless explicitly expanded.
      const config = defaultConfig
        ? await stripe.billingPortal.configurations.retrieve(defaultConfig.id, {
            expand: ["features.subscription_update.products"],
          })
        : null;
      const allowed =
        config?.features.subscription_update.products?.flatMap(
          (item) => item.prices,
        ) || [];
      add(
        "customer portal",
        Boolean(
          config?.features.subscription_cancel.enabled &&
          config.features.subscription_cancel.mode === "at_period_end" &&
          config.features.subscription_update.enabled &&
          [
            process.env.STRIPE_PRO_PRICE_ID,
            process.env.STRIPE_ELITE_PRICE_ID,
          ].every((price) => allowed.includes(price)),
        ),
        "default portal supports both plan prices and cancellation at period end; review proration separately",
      );
    }),
  ]);
} else
  add(
    "remote verification",
    false,
    remote
      ? "credentials missing; no external calls made"
      : "not run; use --remote after configuring a sandbox",
  );
console.log(
  JSON.stringify(
    {
      mode,
      checkoutEnabled: process.env.STRIPE_CHECKOUT_ENABLED === "true",
      billingEmailsEnabled: process.env.BILLING_EMAILS_ENABLED === "true",
      checks,
      ready: checks.every((check) => check.ok),
      note: "Read-only checks. No customers, subscriptions, products, charges, webhooks or emails are created. Signed webhook delivery, SCA, renewals and email delivery require the sandbox acceptance matrix.",
    },
    null,
    2,
  ),
);
process.exitCode = checks.every((check) => check.ok) ? 0 : 1;
