'use client';

import { useContext } from 'react';
import { ProductsContext } from '@/components/providers/products-provider';

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
};
