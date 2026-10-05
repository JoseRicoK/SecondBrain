import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Precios y planes de diario personal con IA",
  "Compara el plan gratuito, Pro y Elite: límites de chat e informes. Empieza sin tarjeta y consulta la disponibilidad de los planes de pago.",
  "/precios",
);
export default function PreciosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
