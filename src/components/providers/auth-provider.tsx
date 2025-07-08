'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, Timestamp, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserData, AuthContextType } from '@/lib/types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      if (firebaseUser.isAnonymous) {
          try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (!docSnap.exists()) {
                await setDoc(userDocRef, {
                    uid: firebaseUser.uid,
                    email: null,
                    role: 'user',
                    createdAt: serverTimestamp(),
                    subscriptions: {},
                });
            }
          } catch (e) {
            console.error("AuthProvider: Failed to create anonymous user doc:", e);
          }

          setUser({
              uid: firebaseUser.uid,
              email: null,
              displayName: 'Visitante',
              photoURL: null,
              subscriptions: {},
              role: 'user',
              emailVerified: true, // Anonymous users don't need verification.
              isAnonymous: true,
          });
          setLoading(false);
          return;
      }

      // For registered users, listen to their Firestore document for real-time updates.
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const subscriptions = data.subscriptions || {};
          
          // Check for expired subscriptions on the fly
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
          // Fallback if Firestore doc doesn't exist yet (e.g., just after signup)
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
        console.error("AuthProvider: Firestore snapshot error:", error);
        setUser(null);
        setLoading(false);
      });

      return () => unsubscribeFirestore();
    });

    return () => unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}
