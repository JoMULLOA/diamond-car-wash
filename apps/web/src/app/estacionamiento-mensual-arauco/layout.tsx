import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estacionamiento Mensual en Arauco | Diamond Car Wash',
  description: 'Unete al Club Diamond y asegura tu lugar de estacionamiento mensual en Arauco. Consulta tu estado de deuda y abona tu cuota online.',
};

export default function MensualidadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
