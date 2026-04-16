import type { Metadata } from 'next';
import './globals.css';
import { WhatsAppButton } from '../components/WhatsAppButton';

export const metadata: Metadata = {
  title: 'Diamond Car Wash — Reservar Turno',
  description: 'Reservá tu turno de lavado online y asegurá tu lugar con un 20% de seña. Servicios premium de lavado de vehículos.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <WhatsAppButton />
      </body>
    </html>
  );
}
