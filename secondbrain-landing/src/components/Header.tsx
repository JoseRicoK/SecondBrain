"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { APP_URL, SIGNUP_URL } from "@/lib/site";
const links = [
  { href: "/#features", label: "Funciones" },
  { href: "/precios", label: "Precios" },
  { href: "/#guias", label: "Guías" },
  { href: "/#faq", label: "FAQ" },
  { href: "/soporte", label: "Soporte" },
];
export default function Header() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-md">
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <Image
            src="/Logo-simple-SecondBrain.png"
            alt=""
            width={32}
            height={32}
            priority
          />
          LumaDiary
        </Link>
        <div className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-300 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <a href={APP_URL} className="text-sm text-slate-300">
            Ir a la App
          </a>
          <a
            href={SIGNUP_URL}
            className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-500"
          >
            Crear cuenta gratis
          </a>
        </div>
        <button
          ref={toggle}
          type="button"
          className="rounded-lg border border-white/20 p-3 text-white lg:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>
      {open && (
        <nav
          id="mobile-navigation"
          aria-label="Navegación móvil"
          className="grid max-h-[calc(100dvh-5rem)] overflow-y-auto gap-1 border-t border-white/10 px-4 pb-5 lg:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-slate-200 hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
          <a href={APP_URL} className="px-3 py-3 text-slate-200">
            Ir a la App
          </a>
          <a
            href={SIGNUP_URL}
            className="rounded-xl bg-purple-600 px-3 py-3 text-center font-semibold text-white"
          >
            Crear cuenta gratis
          </a>
        </nav>
      )}
    </header>
  );
}
