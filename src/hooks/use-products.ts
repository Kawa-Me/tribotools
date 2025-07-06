'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product } from '@/lib/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConfigured, setDbConfigured] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setDbConfigured(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const productsData = snapshot.docs
        .map(doc => doc.data() as Product)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
        console.error("Firestore snapshot error in useProducts:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const allPlans = useMemo(() => {
    return products.flatMap(p => 
        p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
    );
  }, [products]);

  return { products, allPlans, loading, dbConfigured };
}
