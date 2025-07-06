'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserData, UserSubscription, AuthContextType } from '@/lib/types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setGuest] = useState(false);

  useEffect(() => {
    // If firebase is not configured, we set loading to false and user to null.
    if (!auth || !db) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // User is signed in, no longer a guest.
        setGuest(false);
        // Listen to their profile in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubFirestore = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            const expiresAt = data.subscription?.expiresAt as Timestamp | null;
            let currentDbStatus = data.subscription?.status;

            if (currentDbStatus === 'active' && expiresAt && expiresAt.toDate() < new Date()) {
                currentDbStatus = 'expired';
            }
            
            const subscription: UserSubscription = {
              status: currentDbStatus,
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
        // Do not reset guest state here, as they might be navigating as a guest.
      }
    });

    return () => unsubscribe();
  }, []);

  const value = { user, loading, isGuest, setGuest };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
