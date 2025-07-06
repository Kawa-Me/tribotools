// This file is used ONLY to seed the initial data into Firestore.
// To manage products and plans, use the "Planos" section in the Admin Panel.
// Any changes made here will NOT be reflected in the app unless you clear the 'products' collection in Firestore to trigger a re-seed.

import type { Product } from "./types";

export const initialProducts: Product[] = [
    {
        id: 'ferramentas',
        name: 'Acesso às Ferramentas',
        order: 0,
        plans: [
            { id: 'ferramentas_mensal', name: 'Acesso Mensal', price: 57.90, originalPrice: 97.90, description: '30 dias de acesso total.', days: 30, promo: false },
            { id: 'ferramentas_trimestral', name: 'Acesso Trimestral', price: 150.00, originalPrice: 247.90, description: '🔥 MAIS POPULAR: 90 dias de acesso + 5 dias brinde!', days: 90, promo: true },
        ]
    },
    {
        id: 'zapvoice',
        name: 'ZapVoice',
        order: 1,
        plans: [
            { id: 'zapvoice_teste_1dia', name: 'Plano de Teste (1 Dia)', price: 1.00, originalPrice: 1.00, description: 'Plano para teste de webhook.', days: 1, promo: false },
            { id: 'zapvoice_mensal', name: 'Acesso Mensal', price: 5.99, originalPrice: 19.99, description: '30 dias de acesso.', days: 30, promo: false },
            { id: 'zapvoice_trimestral', name: 'Acesso Trimestral', price: 15.00, originalPrice: 49.99, description: '💎 MELHOR OFERTA: 90 dias de acesso.', days: 90, promo: true },
        ]
    }
];
