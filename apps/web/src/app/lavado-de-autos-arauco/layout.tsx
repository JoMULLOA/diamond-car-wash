import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lavado de Autos Premium en Arauco | Diamond Car Wash',
  description: 'Reservá tu turno online para lavado de autos en Arauco. Servicios de estética vehicular, detailing y cuidado premium. Asegurá tu lugar con seña.',
};

export default function LavadoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
