'use client';

// Import the shared component from the local app workspace
import { MainDashboard } from '../../../../local/src/components/MainDashboard';
import { useEffect, useState } from 'react';

export default function NimdaPortalPage() {
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by rendering only on client
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-portal-wrapper">
      <MainDashboard />
    </div>
  );
}
