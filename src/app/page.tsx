"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@/components/loader';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // The main dashboard layout at `/dashboard` now handles all auth logic.
    // This page simply redirects there.
    router.replace('/dashboard');
  }, [router]);

  // Show a loader while redirecting
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader className="h-10 w-10 text-primary" />
    </div>
  );
}
