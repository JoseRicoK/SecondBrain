// Explicit values override .env.local in both Next builds and test servers.
export const testEnvironment = {
  ...process.env,
  SECOND_BRAIN_TEST_BUILD: "1",
  NEXT_PUBLIC_SUPABASE_URL: "https://fixtures.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  OPENAI_API_KEY: "fixture-openai-key",
  RESEND_API_KEY: "re_fixture",
  STRIPE_CHECKOUT_ENABLED: "false",
  STRIPE_SECRET_KEY: "",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
  STRIPE_PRO_PRICE_ID: "",
  STRIPE_ELITE_PRICE_ID: "",
  STRIPE_WEBHOOK_SECRET: "",
  CRON_SECRET: "fixture-cron",
  NEXT_TELEMETRY_DISABLED: "1",
};
