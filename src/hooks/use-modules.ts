'use client';

import { useContext } from 'react';
import { ModulesContext } from '@/components/providers/modules-provider';

export function useModules() {
  const context = useContext(ModulesContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModulesProvider');
  }
  return context;
}
