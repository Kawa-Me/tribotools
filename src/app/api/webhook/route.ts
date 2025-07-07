// ESTA ROTA FOI DESATIVADA E SUBSTITUÍDA POR /src/pages/api/webhook.ts
// Este arquivo existe apenas para evitar erros de compilação, mas a lógica foi movida.
// A rota do App Router estava causando um conflito com a rota do Pages Router.
// Para resolver o problema de forma definitiva, todo o código do webhook agora reside em /pages/api/webhook.ts.
// Você pode remover com segurança a pasta /src/app/api/webhook do seu projeto.

import { NextResponse } from 'next/server';

export async function POST() {
    console.error("ERRO CRÍTICO: A rota de webhook em /app/api/webhook foi acionada, mas está desativada. Verifique o conflito de rotas.");
    // Retorna um status 410 Gone para indicar que este endpoint não está mais disponível.
    return new NextResponse('This endpoint is no longer available.', { status: 410 });
}
