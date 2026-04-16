import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Club de Lavado Premium | Diamond Car Wash Arauco',
  description: 'Portal exclusivo para socios del Club de Lavado Diamond. Consulta tus lavados disponibles y agenda tu próximo turno online.',
};

export default function ClubLavadoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
