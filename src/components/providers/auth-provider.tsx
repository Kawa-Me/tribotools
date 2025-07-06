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
    // Check if Firebase is configured. If not, stop loading and do nothing.
    if (!auth || !db) {
      setUser(null);
      setLoading(false);
      return;
    }

    // This listener handles all authentication state changes.
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      // If a user is signed out, reset state and stop loading.
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      // If the user is anonymous, create a simple visitor object.
      if (firebaseUser.isAnonymous) {
        setUser({
          uid: firebaseUser.uid,
          email: null,
          displayName: 'Visitante',
          photoURL: null,
          subscriptions: {},
          role: 'user', // Anonymous users are treated as 'user' role
          emailVerified: false,
          isAnonymous: true,
        });
        setLoading(false);
        return;
      }

      // If it's a real, registered user, we must fetch their data from Firestore.
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      
      const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Perform an on-the-fly check for expired subscriptions.
          let subscriptions = data.subscriptions || {};
          Object.keys(subscriptions).forEach(key => {
            const sub = subscriptions[key];
            if (sub.status === 'active' && sub.expiresAt && (sub.expiresAt as Timestamp).toDate() < new Date()) {
                subscriptions[key].status = 'expired';
            }
          });

          // Build the complete user object with data from both Auth and Firestore.
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            subscriptions,
            role: data.role || 'user',
            emailVerified: firebaseUser.emailVerified,
            isAnonymous: false,
            // Include personal details if they exist
            name: data.name,
            document: data.document,
            phone: data.phone,
          });
        } else {
           // This case handles a newly registered user whose Firestore document might not exist yet.
           // We provide a default object. The document will be created upon signup/login.
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
        // Only stop loading after we have the full user profile.
        setLoading(false);
      }, (error) => {
        // Handle errors fetching from Firestore (e.g., permissions).
        console.error("AuthProvider: Firestore snapshot error:", error);
        setUser(null); // Reset user state on error
        setLoading(false);
      });
      
      // Return the cleanup function for the Firestore listener.
      return () => unsubscribeFirestore();

    });

    // Return the cleanup function for the Auth listener.
    return () => unsubscribeAuth();
  }, []); // The empty dependency array ensures this effect runs only once on mount.

  const value = { user, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
