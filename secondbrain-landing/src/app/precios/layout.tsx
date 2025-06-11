import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Precios - SecondBrain | Tu Segundo Cerebro Digital',
  description: 'Planes que se adaptan a tu ritmo. Desde gratuito hasta profesional. Todos los planes incluyen las funciones esenciales para comenzar tu viaje de autodescubrimiento.',
  keywords: ['precios', 'planes', 'suscripción', 'diario personal', 'IA', 'SecondBrain'],
  openGraph: {
    title: 'Precios - SecondBrain',
    description: 'Planes que se adaptan a tu ritmo. Desde gratuito hasta profesional.',
    type: 'website',
  },
};

export default function PreciosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
