"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { Loader } from '@/components/loader';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until loading is false
    if (!loading) {
      if (user) {
        // If user is admin (and not the anon placeholder), go to admin page
        if (user.role === 'admin' && !user.isAnonymous) {
          router.replace('/admin');
        } else {
          // Otherwise, go to dashboard (this will handle anon and regular users)
          router.replace('/dashboard');
        }
      } else {
        // This case would mean anonymous sign-in failed. Redirect to login to allow a manual attempt.
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // Show a loader while the AuthProvider is working
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader className="h-10 w-10 text-primary" />
    </div>
  );
}
