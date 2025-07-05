'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserData, UserSubscription, AuthContextType } from '@/lib/types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If firebase is not configured, we set loading to false and user to null.
    if (!auth || !db) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // User is signed in, listen to their profile in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubFirestore = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            const expiresAt = data.subscription?.expiresAt as Timestamp | null;
            
            const subscription: UserSubscription = {
              status: data.subscription?.status === 'active' && expiresAt && expiresAt.toDate() > new Date() ? 'active' : 'expired',
              plan: data.subscription?.plan || null,
              expiresAt,
              startedAt: data.subscription?.startedAt || null,
            };

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              subscription,
              role: data.role || 'user',
            });
          } else {
             // If no firestore doc, create a default user profile
             const defaultSubscription: UserSubscription = { status: 'none', plan: null, expiresAt: null, startedAt: null };
             setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              subscription: defaultSubscription,
              role: 'user',
             });
          }
          setLoading(false);
        });
        return () => unsubFirestore();
      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}
