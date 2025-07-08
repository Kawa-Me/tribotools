'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payment } from '@/lib/types';
import { useAuth } from '@/lib/hooks';

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') {
      if (!authLoading) setLoading(false);
      return;
    }

    if (!db) {
      setError('Serviço de banco de dados não configurado.');
      setLoading(false);
      return;
    }
    
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const paymentsData: Payment[] = [];
        querySnapshot.forEach((doc) => {
          paymentsData.push(doc.data() as Payment);
        });
        setPayments(paymentsData);
        setError(null);
        setLoading(false);
      },
      (firestoreError) => {
        console.error("Firestore snapshot error in usePayments:", firestoreError);
        if (firestoreError.code === 'permission-denied') {
          setError('Acesso negado. Suas regras de segurança do Firestore não permitem que administradores listem os pagamentos. Por favor, atualize as regras de segurança no console do Firebase.');
        } else {
          setError('Ocorreu um erro inesperado ao buscar os pagamentos.');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  return { payments, loading, error };
}
