export const products = {
    ferramentas: {
        id: 'ferramentas',
        name: 'Acesso às Ferramentas',
        plans: [
            { id: 'ferramentas_mensal', name: 'Acesso Mensal', price: 57.90, description: '30 dias de acesso', days: 30 },
            { id: 'ferramentas_trimestral', name: 'Acesso Trimestral', price: 150.00, description: '60 dias de acesso', days: 60 },
        ]
    },
    zapvoice: {
        id: 'zapvoice',
        name: 'ZapVoice',
        plans: [
            { id: 'zapvoice_mensal', name: 'Acesso Mensal', price: 5.99, description: '30 dias de acesso', days: 30 },
        ]
    }
} as const;

export const allPlans = Object.values(products).flatMap(p => 
    p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
);

export type PlanId = (typeof allPlans)[number]['id'];
