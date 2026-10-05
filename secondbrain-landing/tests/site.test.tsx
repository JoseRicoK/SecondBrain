// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import FAQSection, { faqs } from "@/components/FAQSection";
import PricingSection from "@/components/PricingSection";
import Header from "@/components/Header";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef(
      ({ children, href, onClick, ...props }: any, ref: any) =>
        React.createElement(
          "a",
          {
            ...props,
            href,
            ref,
            onClick: (event: any) => {
              event.preventDefault();
              onClick?.(event);
            },
          },
          children,
        ),
    ),
  };
});
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const cache: Record<string, any> = {};
  return {
    motion: new Proxy(
      {},
      {
        get: (_, key: string) =>
          (cache[key] ??= React.forwardRef(
            (
              {
                children,
                initial,
                animate,
                exit,
                transition,
                whileInView,
                viewport,
                whileHover,
                whileTap,
                ...props
              }: any,
              ref: any,
            ) => React.createElement(key, { ...props, ref }, children),
          )),
      },
    ),
    AnimatePresence: ({ children }: any) => children,
  };
});
it.each(faqs)("FAQ toggles $question", async (faq) => {
  render(<FAQSection />);
  const u = userEvent.setup();
  const trigger = screen.getByText(faq.question);
  expect(screen.getByText(faq.answer)).not.toBeVisible();
  await u.click(trigger);
  expect(screen.getByText(faq.answer)).toBeVisible();
  await u.click(trigger);
  expect(screen.getByText(faq.answer)).not.toBeVisible();
});
it.each([
  ["Comenzar Gratis", "free"],
  ["Comenzar Pro", "pro"],
  ["Comenzar Elite", "elite"],
])("pricing CTA %s keeps plan in the signup URL", async (label, plan) => {
  render(
    <PricingSection
      catalog={{
        checkoutEnabled: true,
        verified: true,
        limits: {
          free: {
            personalChatMessages: 5,
            personChatMessages: 10,
            statisticsAccess: 0,
          },
          pro: {
            personalChatMessages: 30,
            personChatMessages: 100,
            statisticsAccess: 10,
          },
          elite: {
            personalChatMessages: 100,
            personChatMessages: 500,
            statisticsAccess: -1,
          },
        },
      }}
    />,
  );
  expect(screen.getByRole("link", { name: label })).toHaveAttribute(
    "href",
    `https://app.secondbrainapp.com/signup?plan=${plan}`,
  );
});
it("mobile menu can open, navigate and close", async () => {
  render(<Header />);
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Abrir menú" }));
  expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeVisible();
  const links = screen.getAllByRole("link", { name: "Precios", exact: true });
  expect(links).toHaveLength(2);
  await u.click(links[1]);
  expect(screen.getByRole("button", { name: "Abrir menú" })).toBeVisible();
  expect(
    screen.getAllByRole("link", { name: "Precios", exact: true }),
  ).toHaveLength(1);
});
it("sitemap has unique canonical URLs for all actual public routes", () => {
  const urls = sitemap().map((row) => row.url);
  expect(new Set(urls).size).toBe(urls.length);
  expect(urls).toEqual(
    [
      "",
      "/precios",
      "/diario-personal-con-ia",
      "/diario-de-voz",
      "/como-empezar-un-diario",
      "/privacidad",
      "/terminos",
      "/soporte",
    ].map((path) => `https://www.secondbrainapp.com${path}`),
  );
  expect(urls.some((url) => url.includes("/en"))).toBe(false);
});
it("robots includes private-path exclusion and canonical sitemap", () => {
  const config = robots();
  expect(config.sitemap).toBe("https://www.secondbrainapp.com/sitemap.xml");
  const rules = config.rules as any[];
  expect(rules.find((rule) => rule.userAgent === "*")).toMatchObject({
    allow: "/",
    disallow: ["/api/", "/admin/"],
  });
  for (const bot of [
    "Googlebot",
    "Bingbot",
    "GPTBot",
    "Twitterbot",
    "WhatsApp",
  ])
    expect(rules.some((rule) => rule.userAgent === bot)).toBe(true);
});
