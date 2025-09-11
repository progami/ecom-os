'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the new financial dashboard
    router.push('/financial-dashboard');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg text-gray-600">Redirecting to E2 Financial Model...</p>
    </div>
  );
}