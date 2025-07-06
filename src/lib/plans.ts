export const plans = [
    { id: 'mensal', name: 'Acesso Mensal', price: 57.90, description: '30 dias de acesso' },
    { id: 'trimestral', name: 'Acesso Trimestral', price: 150.00, description: '60 dias de acesso' },
] as const;

export type PlanId = typeof plans[number]['id'];
