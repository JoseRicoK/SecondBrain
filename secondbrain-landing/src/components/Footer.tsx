import Link from "next/link";
import { guides } from "@/lib/content";
export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-12">
      <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-3">
        <div>
          <Link href="/" className="text-xl font-bold text-white">
            SecondBrain
          </Link>
          <p className="mt-3 text-slate-400">
            Un espacio para escribir, recordar y reflexionar.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            © {new Date().getFullYear()} SecondBrain
          </p>
        </div>
        <nav aria-label="Guías del diario" className="space-y-3">
          {guides.map((g) => (
            <Link
              className="block text-slate-300 hover:text-white"
              key={g.slug}
              href={"/" + g.slug}
            >
              {g.title.split(":")[0]}
            </Link>
          ))}
        </nav>
        <nav aria-label="Información" className="space-y-3">
          {[
            ["/precios", "Precios"],
            ["/privacidad", "Privacidad"],
            ["/terminos", "Términos"],
            ["/soporte", "Soporte"],
          ].map(([url, label]) => (
            <Link
              key={url}
              href={url}
              className="block text-slate-300 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
