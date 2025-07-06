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
          setUser({
            uid: firebaseUser.uid,
            email: null,
            displayName: 'Visitante',
            photoURL: null,
            subscriptions: {},
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
              let subscriptions = data.subscriptions || {};

              // Legacy user migration on-the-fly from 'subscription' to 'subscriptions.ferramentas'
              if (data.subscription && Object.keys(subscriptions).length === 0) {
                subscriptions.ferramentas = data.subscription;
              }
              
              // Check for expirations in the new structure
              Object.keys(subscriptions).forEach(key => {
                const sub = subscriptions[key];
                if (sub.status === 'active' && sub.expiresAt && (sub.expiresAt as Timestamp).toDate() < new Date()) {
                    subscriptions[key].status = 'expired';
                }
              });

              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                subscriptions,
                role: data.role || 'user',
                isAnonymous: false,
              });
            } else {
             // If no firestore doc, create a default user profile
             setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              subscriptions: {},
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
