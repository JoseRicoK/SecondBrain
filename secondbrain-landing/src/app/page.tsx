import Link from "next/link";
import {
  Mic,
  CalendarDays,
  MessageCircle,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  BarChart3,
  Check,
  AudioLines,
  PenLine,
  Heart,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FAQSection from "@/components/FAQSection";
import CtaSection from "@/components/CtaSection";
import ProductPreview from "@/components/ProductPreview";
import {
  VoiceArtwork,
  ChatArtwork,
  ChartArtwork,
} from "@/components/ProductArtwork";
import { guides } from "@/lib/content";
import { SIGNUP_URL, SITE_URL, jsonLd } from "@/lib/site";
const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": SITE_URL + "/#app",
  name: "LumaDiary",
  url: SITE_URL,
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  inLanguage: "es",
  description:
    "Diario personal web con escritura, transcripción de voz y reflexión asistida por IA.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    url: SIGNUP_URL,
  },
  featureList: [
    "Diario por fechas",
    "Transcripción de voz",
    "Chat con IA",
    "Personas",
    "Estadísticas",
  ],
};
export default function Home() {
  return (
    <div className="visual-landing">
      <Header />
      <main id="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
        />
        <section className="visual-hero">
          <div className="hero-orbit" aria-hidden="true" />
          <div className="hero-copy">
            <span className="eyebrow-pill">
              <Sparkles size={14} />
              Un segundo cerebro. Muy tuyo.
            </span>
            <h1>
              Tu vida merece
              <br />
              más que un
              <br />
              <span>recuerdo borroso.</span>
            </h1>
            <p>
              Tu diario personal con IA. Escribe, habla y vuelve a lo que de
              verdad importa.
            </p>
            <div className="hero-actions">
              <Link href={SIGNUP_URL} className="visual-button">
                Crear mi diario gratis <ArrowRight size={18} />
              </Link>
              <Link href="#features" className="visual-link">
                Explorar la app <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-reassurance">
              <span>
                <Check size={14} />
                Sin tarjeta
              </span>
              <span>
                <Check size={14} />
                Desde tu navegador
              </span>
            </div>
          </div>
          <ProductPreview />
        </section>
        <div className="feature-ribbon" aria-label="Funciones del diario">
          {[
            [BookOpen, "Escribe"],
            [Mic, "Habla"],
            [MessageCircle, "Reflexiona"],
            [Users, "Recuerda"],
            [BarChart3, "Descubre"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof BookOpen;
            return (
              <span key={String(label)}>
                <I size={20} />
                {String(label)}
              </span>
            );
          })}
        </div>
        <section id="features" className="visual-section">
          <div className="section-heading">
            <span className="section-kicker">TODO LO QUE VIVES, CONECTADO</span>
            <h2>
              Un diario.
              <br />
              <span>Muchas formas de descubrirte.</span>
            </h2>
            <p>Menos ruido. Más espacio para tu historia.</p>
          </div>
          <div className="feature-bento">
            <article className="bento-card bento-diary">
              <div className="bento-copy">
                <span className="feature-icon">
                  <PenLine size={23} />
                </span>
                <h3>Tu día. Tus palabras.</h3>
                <p>Un lugar para escribir y volver a tus recuerdos.</p>
              </div>
              <div className="mini-entry" aria-hidden="true">
                <div>
                  <CalendarDays size={15} />
                  <span>30 SEPTIEMBRE</span>
                  <i>
                    <Check size={12} />
                    Guardado
                  </i>
                </div>
                <strong>Hoy me quedo con esto…</strong>
                <p>El paseo. La conversación. Ese rato sin prisa.</p>
                <div className="entry-rule" />
                <div className="entry-rule short" />
                <span className="entry-person">
                  <Heart size={13} />
                  Pequeños momentos
                </span>
                <span className="entry-pencil">
                  <PenLine size={21} />
                </span>
              </div>
            </article>
            <article className="bento-card bento-voice">
              <span className="feature-icon">
                <Mic size={23} />
              </span>
              <h3>Hablar también es escribir.</h3>
              <p>Graba, transcribe y revisa.</p>
              <VoiceArtwork compact />
            </article>
            <article className="bento-card bento-chat">
              <span className="feature-icon">
                <MessageCircle size={23} />
              </span>
              <h3>Una pregunta puede cambiar la mirada.</h3>
              <p>Conversa con IA sobre tus experiencias.</p>
              <ChatArtwork compact />
            </article>
            <article className="bento-card bento-people">
              <span className="feature-icon">
                <Users size={23} />
              </span>
              <h3>Las personas de tu historia.</h3>
              <p>Recuerda lo que habéis compartido.</p>
              <div className="people-art" aria-hidden="true">
                <span className="person-core">
                  <Users size={26} />
                </span>
                {["A", "L", "M", "S"].map((name, i) => (
                  <span key={name} className={"person-node person-" + i}>
                    {name}
                  </span>
                ))}
                <svg viewBox="0 0 260 130">
                  <path d="M130 65 L50 28 M130 65 L212 24 M130 65 L36 109 M130 65 L223 109" />
                </svg>
              </div>
            </article>
            <article className="bento-card bento-stats">
              <div className="bento-copy">
                <span className="feature-icon">
                  <BarChart3 size={23} />
                </span>
                <h3>Toma perspectiva.</h3>
                <p>
                  Informes y gráficas para revisar tus experiencias.
                  <br />
                  <span className="feature-disclosure">
                    En planes con estadísticas · ejemplo ficticio
                  </span>
                </p>
              </div>
              <ChartArtwork compact />
            </article>
          </div>
          <div className="privacy-strip">
            <ShieldCheck size={20} />
            <p>Tu historia, asociada a tu cuenta.</p>
            <Link href="/privacidad">
              Así cuidamos tus datos <ArrowRight size={15} />
            </Link>
          </div>
        </section>
        <section id="como-funciona" className="visual-section steps-section">
          <div className="section-heading">
            <span className="section-kicker">
              EMPIEZA SIN DARLE MIL VUELTAS
            </span>
            <h2>
              De tu día a tu diario.
              <br />
              <span>Así de sencillo.</span>
            </h2>
          </div>
          <ol className="visual-steps">
            {[
              [PenLine, "01", "Escribe algo.", "Una frase basta para empezar."],
              [
                AudioLines,
                "02",
                "O cuéntalo.",
                "Guarda tu entrada y añade tu voz.",
              ],
              [
                Sparkles,
                "03",
                "Vuelve con otra mirada.",
                "Relee, pregunta y reflexiona.",
              ],
            ].map(([Icon, num, title, text]) => {
              const I = Icon as typeof BookOpen;
              return (
                <li key={String(num)}>
                  <span className="step-icon">
                    <I size={29} />
                    <b>{String(num)}</b>
                  </span>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </li>
              );
            })}
          </ol>
          <div className="steps-action">
            <Link href={SIGNUP_URL} className="visual-button">
              Escribir mi primera entrada <ArrowRight size={18} />
            </Link>
            <span>Cuenta gratuita. A tu ritmo.</span>
          </div>
        </section>
        <section className="visual-section">
          <div className="plan-teaser">
            <span className="plan-teaser-icon">
              <Sparkles size={36} />
            </span>
            <div>
              <span className="section-kicker">PRIMERO, PRUÉBALO</span>
              <h2>
                Empieza gratis.
                <br />
                Elige después.
              </h2>
              <p>Diario, voz y cuotas de chat para comenzar.</p>
            </div>
            <Link href="/precios" className="visual-button secondary">
              Ver planes y límites <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <section id="guias" className="visual-section guides-section">
          <div className="section-heading">
            <span className="section-kicker">UN POCO DE INSPIRACIÓN</span>
            <h2>
              Tu primera página
              <br />
              <span>empieza aquí.</span>
            </h2>
          </div>
          <div className="visual-guides">
            {guides.map((g, i) => {
              const Icon = [Sparkles, Mic, BookOpen][i];
              return (
                <Link
                  key={g.slug}
                  href={"/" + g.slug}
                  className={"guide-tile guide-" + i}
                >
                  <div className="guide-cover" aria-hidden="true">
                    <Icon size={48} />
                    <span className="guide-orbit" />
                    <span className="guide-number">0{i + 1}</span>
                  </div>
                  <span className="guide-label">GUÍA PARA EMPEZAR</span>
                  <h3>
                    {
                      [
                        "Un diario con IA. Una mirada nueva.",
                        "Tu voz también tiene una historia.",
                        "¿En blanco? Empieza por aquí.",
                      ][i]
                    }
                  </h3>
                  <span className="guide-read">
                    Leer la guía <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
        <FAQSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
