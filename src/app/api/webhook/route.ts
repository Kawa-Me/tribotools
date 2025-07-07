
import { NextResponse } from 'next/server';

// ATENÇÃO: ESTA ROTA FOI DESATIVADA E SUBSTITUÍDA.
// O webhook ativo agora está em /pages/api/webhook.ts para resolver
// um conflito de roteamento entre o App Router e o Pages Router.
// Este arquivo pode ser removido com segurança em um próximo deploy.

export async function POST(req: Request) {
    console.error("ERRO CRÍTICO: A rota de webhook desativada (/app/api/webhook) foi chamada. Verifique a URL configurada no seu provedor de pagamento e aponte para /api/webhook.");
    return NextResponse.json({ 
        error: 'Rota Desativada', 
        message: 'Esta rota de webhook (/app/api/webhook) não está mais em uso. A rota correta é /api/webhook (implementada via Pages Router).'
    }, { status: 410 }); // 410 Gone
}
