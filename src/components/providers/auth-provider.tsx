'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserData, AuthContextType } from '@/lib/types';

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

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // A user is signed in (either anonymous or real).
        // Subscribe to their Firestore document for real-time data.
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
          if (firebaseUser.isAnonymous) {
            setUser({
              uid: firebaseUser.uid,
              email: null,
              displayName: 'Visitante',
              photoURL: null,
              subscriptions: {},
              role: 'user',
              emailVerified: false,
              isAnonymous: true,
            });
            setLoading(false);
            return;
          }

          // It's a real user.
          if (docSnap.exists()) {
            const data = docSnap.data();
            let subscriptions = data.subscriptions || {};
            
            // On-the-fly expiration check.
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
              emailVerified: firebaseUser.emailVerified,
              isAnonymous: false,
              name: data.name,
              document: data.document,
              phone: data.phone,
            });
          } else {
             // Real user authenticated but no Firestore doc exists yet (e.g., right after signup).
             // Provide a default user object.
             setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              subscriptions: {},
              role: 'user',
              emailVerified: firebaseUser.emailVerified,
              isAnonymous: false,
             });
          }
          setLoading(false);
        }, (error) => {
          console.error("Firestore snapshot error in AuthProvider:", error);
          setUser(null);
          setLoading(false);
        });
        
        // This is the cleanup function for the Firestore listener.
        return () => unsubscribeFirestore();

      } else {
        // No user is signed in at all.
        setUser(null);
        setLoading(false);
      }
    });

    // This is the cleanup function for the Auth listener.
    return () => unsubscribeAuth();
  }, []);

  const value = { user, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
