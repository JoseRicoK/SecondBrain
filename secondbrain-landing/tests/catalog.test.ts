import { it, expect, vi } from "vitest";
import { FALLBACK_CATALOG, parseCatalog, getCatalog } from "@/lib/plans";
import { pageMetadata, jsonLd } from "@/lib/site";
it.each([
  null,
  {},
  { checkoutEnabled: true, limits: {} },
  {
    ...FALLBACK_CATALOG,
    limits: {
      ...FALLBACK_CATALOG.limits,
      pro: {
        personalChatMessages: "30",
        personChatMessages: 100,
        statisticsAccess: 10,
      },
    },
  },
])("rejects incomplete or forged catalogue values", (value) =>
  expect(parseCatalog(value)).toBeNull(),
);
it("reads edited limits from the authoritative public catalogue", () => {
  const value = {
    ...FALLBACK_CATALOG,
    limits: {
      ...FALLBACK_CATALOG.limits,
      pro: {
        personalChatMessages: 42,
        personChatMessages: 100,
        statisticsAccess: 10,
      },
    },
  };
  expect(parseCatalog(value)?.limits.pro.personalChatMessages).toBe(42);
});
it("test builds never fetch production", async () => {
  vi.stubEnv("SECOND_BRAIN_TEST_BUILD", "1");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await getCatalog()).toMatchObject({
    checkoutEnabled: false,
    verified: true,
  });
  expect(fetch).not.toHaveBeenCalled();
});
it("catalogue outage keeps signup open and paid checkout closed", async () => {
  vi.stubEnv("SECOND_BRAIN_TEST_BUILD", "");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
  expect(await getCatalog()).toEqual(FALLBACK_CATALOG);
});
it("successful public response uses a 60 second cache and edited limits", async () => {
  vi.stubEnv("SECOND_BRAIN_TEST_BUILD", "");
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ ...FALLBACK_CATALOG, checkoutEnabled: true }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  expect((await getCatalog()).checkoutEnabled).toBe(true);
  expect(fetch.mock.calls[0][1].next.revalidate).toBe(60);
});
it("each metadata helper resolves a distinct canonical and social URL", () => {
  const metadata = pageMetadata("Guía", "Descripción", "/diario-de-voz");
  expect(metadata.alternates?.canonical).toBe(
    "https://www.lumadiary.com/diario-de-voz",
  );
  expect(metadata.openGraph?.url).toBe(metadata.alternates?.canonical);
});
it("JSON-LD escapes script terminators while preserving the original value", () => {
  const value = { text: "</script><script>alert(1)</script>" };
  const encoded = jsonLd(value);
  expect(encoded).not.toContain("</script>");
  expect(JSON.parse(encoded)).toEqual(value);
});
