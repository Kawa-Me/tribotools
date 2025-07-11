'use client';

import { createContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product } from '@/lib/types';

interface ProductsContextType {
    products: Product[];
    allPlans: (Product['plans'][number] & { productId: string; productName: string })[];
    loading: boolean;
    dbConfigured: boolean;
}

export const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
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

  const value = { products, allPlans, loading, dbConfigured };

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}
