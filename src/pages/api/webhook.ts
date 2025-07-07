
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { Product } from '@/lib/types';
import { URLSearchParams } from 'url';

// Helper para inicializar o Firebase Admin SDK (garante uma única instância)
const initializeAdminApp = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error('CRÍTICO: A variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não está definida.');
  }
  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('Falha ao analisar FIREBASE_SERVICE_ACCOUNT_KEY. Verifique se é um JSON válido.');
    throw new Error(`Falha ao analisar FIREBASE_SERVICE_ACCOUNT_KEY: ${e.message}`);
  }
};

// Helper para buscar os planos do Firestore usando o Admin SDK
async function getPlansFromFirestoreAdmin(db: admin.firestore.Firestore) {
  const productsSnapshot = await db.collection('products').get();
  if (productsSnapshot.empty) return [];
  const products = productsSnapshot.docs.map(doc => doc.data() as Product);
  return products.flatMap(p => 
    p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
  );
}

// Desativa o parser de corpo padrão do Next.js para que possamos ler o corpo bruto (raw)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper para ler o corpo bruto da requisição
async function getRawBody(req: NextApiRequest): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve(body);
        });
        req.on('error', err => {
            reject(err);
        });
    });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    console.log('✅ Webhook do Pages Router está ativo e processando uma requisição.');
  
    let db: admin.firestore.Firestore;
    try {
      initializeAdminApp();
      db = admin.firestore();
    } catch(error: any) {
      console.error('Erro no Webhook: Não foi possível inicializar o banco de dados do Admin.', error.message);
      return res.status(500).json({ error: 'Erro Interno do Servidor: Serviço de banco de dados não configurado.' });
    }

    try {
        const bodyText = await getRawBody(req);
        const params = new URLSearchParams(bodyText);
        const rawBody: { [key:string]: any } = Object.fromEntries(params.entries());

        console.log('📦 Corpo do Webhook analisado (x-www-form-urlencoded):', rawBody);

        let parsedMetadata;
        if (rawBody.metadata && typeof rawBody.metadata === 'string') {
            try {
                parsedMetadata = JSON.parse(rawBody.metadata);
            } catch (e) {
                console.error('Erro ao analisar os metadados do webhook:', rawBody.metadata, e);
                return res.status(400).json({ error: 'Formato de metadados inválido no corpo do webhook.' });
            }
        }

        const { status, id: transactionId, payer_name, payer_national_registration, value } = rawBody;

        if (status !== 'paid') {
            console.log(`Ignorando transação ${transactionId} com status: ${status}`);
            return res.status(200).json({ success: true, message: `Evento ignorado, status não é 'paid'.` });
        }

        if (!parsedMetadata || !parsedMetadata.userId || !parsedMetadata.planIds) {
            console.error(`CRÍTICO: Webhook para transação ${transactionId} sem metadados ou com metadados malformados. Acesso não pode ser concedido.`, parsedMetadata);
            return res.status(400).json({ error: 'Corpo do webhook não contém os metadados necessários.' });
        }

        const { userId, planIds } = parsedMetadata;
        console.log(`Processando usuário ID: ${userId} para planos: ${planIds.join(', ')}`);
        
        const userDocRef = db.collection('users').doc(userId);
        const userDocSnap = await userDocRef.get();

        if (!userDocSnap.exists) {
            console.error(`Usuário com ID ${userId} da transação ${transactionId} não encontrado.`);
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const userData = userDocSnap.data()!;
        console.log(`Usuário ${userData.email} encontrado para concessão de acesso.`);
        
        const allPlans = await getPlansFromFirestoreAdmin(db);
        
        if (allPlans.length === 0) {
            console.error(`Não foi possível buscar nenhum plano do Firestore. Abortando ativação para usuário ${userId}.`);
            return res.status(500).json({ error: 'Não foi possível buscar planos do banco de dados.' });
        }

        const newSubscriptions = { ...(userData.subscriptions || {}) };
        let changesMade = false;

        for (const planId of planIds) {
            const plan = allPlans.find(p => p.id === planId);
            if (plan) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + plan.days);

                newSubscriptions[plan.productId] = {
                status: 'active',
                plan: plan.id,
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                };
                changesMade = true;
                console.log(`Assinatura preparada para produto '${plan.productName}' no plano '${plan.name}' para o usuário ${userId}.`);
            } else {
                console.warn(`Plano com ID ${planId} dos metadados não encontrado nos planos atuais. Pode ter sido excluído.`);
            }
        }

        if (changesMade) {
            await userDocRef.update({ subscriptions: newSubscriptions });
            console.log(`✅ Acesso concedido e registro do usuário ${userId} atualizado.`);
        }

        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (n8nWebhookUrl) {
            console.log('🚀 Enviando para o webhook n8n...');
            fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                event: 'payment_success',
                email: userData.email,
                name: payer_name || userData.name,
                phone: userData.phone,
                document: payer_national_registration || userData.document,
                planIds: planIds,
                amount: Number(value) / 100,
                paymentDate: new Date().toISOString(),
                transactionId: transactionId,
                }),
            }).catch(err => {
                console.error('❌ Falha ao enviar dados para n8n:', err);
            });
        }

        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('---!!! ERRO FATAL NO WEBHOOK !!!---');
        console.error(error);
        const errorMessage = error.message || 'Ocorreu um erro desconhecido.';
        return res.status(500).json({ error: 'Erro Interno do Servidor', details: errorMessage });
    }
}
