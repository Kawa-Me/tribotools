export const products = {
    ferramentas: {
        id: 'ferramentas',
        name: 'Acesso às Ferramentas',
        plans: [
            { id: 'ferramentas_mensal', name: 'Acesso Mensal', price: 57.90, originalPrice: 97.90, description: '30 dias de acesso total.', days: 30, promo: false },
            { id: 'ferramentas_trimestral', name: 'Acesso Trimestral', price: 150.00, originalPrice: 247.90, description: '🔥 MAIS POPULAR: 60 dias de acesso.', days: 60, promo: true },
        ]
    },
    zapvoice: {
        id: 'zapvoice',
        name: 'ZapVoice',
        plans: [
            { id: 'zapvoice_mensal', name: 'Acesso Mensal', price: 5.99, originalPrice: 19.99, description: '30 dias de acesso.', days: 30, promo: false },
            { id: 'zapvoice_trimestral', name: 'Acesso Trimestral', price: 15.00, originalPrice: 49.99, description: '💎 MELHOR OFERTA: 90 dias de acesso.', days: 90, promo: true },
        ]
    }
} as const;

export const allPlans = Object.values(products).flatMap(p => 
    p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
);

export type PlanId = (typeof allPlans)[number]['id'];
