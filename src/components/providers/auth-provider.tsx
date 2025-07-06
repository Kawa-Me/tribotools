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
    if (!auth || !db) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        if (firebaseUser.isAnonymous) {
          // Handle anonymous user
          const anonymousSubscription: UserSubscription = { status: 'none', plan: null, expiresAt: null, startedAt: null };
          setUser({
            uid: firebaseUser.uid,
            email: null,
            displayName: 'Visitante',
            photoURL: null,
            subscription: anonymousSubscription,
            role: 'user',
            isAnonymous: true,
          });
          setLoading(false);
        } else {
          // Handle authenticated, non-anonymous user
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
                isAnonymous: false,
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
              isAnonymous: false,
             });
            }
            setLoading(false);
          }, (error) => {
            console.error("Firestore snapshot error in AuthProvider:", error);
            setUser(null);
            setLoading(false);
          });
          return () => unsubFirestore();
        }
      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = { user, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
