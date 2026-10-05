import Link from "next/link";
import { SIGNUP_URL } from "@/lib/site";
import { BookOpen, ArrowRight, Sparkles } from "lucide-react";
export default function CtaSection() {
  return (
    <section className="px-6 py-16">
      <div className="final-visual-cta mx-auto max-w-5xl rounded-3xl border border-purple-400/30 p-8 text-center sm:p-14">
        <span className="final-cta-icon" aria-hidden="true">
          <BookOpen size={32} />
          <Sparkles size={15} />
        </span>
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Empieza con lo que te ha pasado hoy
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Una frase, una nota de voz o una pregunta. Tu primera entrada no tiene
          que ser perfecta.
        </p>
        <Link href={SIGNUP_URL} className="visual-button mt-8">
          Crear mi diario gratis <ArrowRight size={18} />
        </Link>
        <p className="mt-3 text-sm text-slate-300">
          Sin tarjeta · Desde tu navegador · Cuenta gratuita
        </p>
      </div>
    </section>
  );
}
