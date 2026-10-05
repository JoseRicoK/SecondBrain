import Link from "next/link";
import { faqs } from "@/lib/content";
export { faqs } from "@/lib/content";
export default function FAQSection() {
  return (
    <section id="faq" className="scroll-mt-24 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-3xl font-bold text-white">
          Preguntas Frecuentes
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              name="secondbrain-faq"
              key={faq.question}
              className="group rounded-2xl border border-white/10 bg-white/5"
            >
              <summary className="cursor-pointer p-6 font-semibold text-white focus-visible:outline-purple-400">
                {faq.question}
              </summary>
              <p
                id={"faq-" + i}
                className="px-6 pb-6 leading-relaxed text-slate-300"
              >
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-slate-300">
          ¿Necesitas ayuda?{" "}
          <Link href="/soporte" className="text-purple-300 underline">
            Consulta el centro de soporte
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
