
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { Plan, Product } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';
import { Buffer } from 'buffer';

// Desabilita o body parser padrão do Next.js para esta rota.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper para ler o corpo da requisição manualmente.
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

// Helper para inicializar o Firebase Admin SDK apenas uma vez.
const initializeAdminApp = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }
  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY.');
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${e.message}`);
  }
};

// Helper para buscar planos do Firestore com o Admin SDK
async function getPlansFromFirestoreAdmin(db: admin.firestore.Firestore): Promise<(Plan & { productId: string, productName: string })[]> {
  const productsSnapshot = await db.collection('products').get();
  if (productsSnapshot.empty) return [];
  const products = productsSnapshot.docs.map(doc => doc.data() as Product);
  return products.flatMap(p => 
    p.plans.map(plan => ({ ...plan, productId: p.id, productName: p.name }))
  );
}

// Helper para notificar seu sistema de automação (n8n).
async function notifyAutomationSystem(payload: any) {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
        console.warn('N8N_WEBHOOK_URL não está configurado. Pulando notificação.');
        return;
    }
    try {
        await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        console.log('Notificação enviada com sucesso para o sistema de automação.');
    } catch (error) {
        console.error('Falha ao enviar notificação para o sistema de automação:', error);
    }
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const rawBody = await getRawBody(req);
    const bodyString = rawBody.toString('utf-8');
    
    const params = new URLSearchParams(bodyString);
    const status = params.get('status');
    
    if (status !== 'paid') {
      console.log(`Webhook ignorado: status é "${status}", não "paid".`);
      return res.status(200).json({ message: 'Webhook ignorado: evento não relevante.' });
    }

    const pushinpayTransactionId = params.get('id');
    // Tentativa 1 (ideal): Obter nosso ID diretamente do webhook, se o gateway o enviar de volta.
    // Estamos tentando `order_id` e `metadata[localTransactionId]`.
    let localTransactionId = params.get('order_id') || params.get('metadata[localTransactionId]');

    initializeAdminApp();
    const db = admin.firestore();
    let paymentRef: admin.firestore.DocumentReference | null = null;

    if (localTransactionId) {
      console.log(`[webhook.ts] ID local recebido diretamente no payload: ${localTransactionId}`);
      paymentRef = db.collection('payments').doc(localTransactionId);
    } else {
      // Tentativa 2 (fallback): Se nosso ID não veio, buscamos pelo ID do gateway.
      // Isso pode falhar por condição de corrida, por isso a retentativa.
      console.warn(`[webhook.ts] ID local não recebido no payload. Tentando fallback com ID do gateway: ${pushinpayTransactionId}`);
      if (pushinpayTransactionId) {
        for (let i = 0; i < 3; i++) { // Tenta até 3 vezes
          const paymentsQuery = db.collection('payments').where('pushinpayTransactionId', '==', pushinpayTransactionId).limit(1);
          const querySnapshot = await paymentsQuery.get();
          if (!querySnapshot.empty) {
            const paymentDoc = querySnapshot.docs[0];
            paymentRef = paymentDoc.ref;
            localTransactionId = paymentDoc.id; // Encontramos!
            console.log(`[webhook.ts] Fallback bem-sucedido na tentativa ${i + 1}. Encontrado localTransactionId: ${localTransactionId}`);
            break; // Sai do loop
          }
          if (i < 2) { // Não espera na última tentativa
             console.log(`[webhook.ts] Tentativa ${i + 1} do fallback falhou. Tentando novamente em 2 segundos...`);
             await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
          }
        }
      }
    }

    if (!paymentRef || !localTransactionId) {
      const processedBody = Object.fromEntries(params.entries());
      console.error('CRITICAL: Impossível identificar o pagamento do webhook, mesmo com fallback.', processedBody);
      return res.status(400).json({ error: 'Não foi possível identificar a transação local correspondente a este webhook.' });
    }

    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
        console.error(`CRITICAL: Documento de pagamento com ID ${localTransactionId} não encontrado no Firestore.`);
        throw new Error(`Documento de pagamento não encontrado.`);
    }
    
    const paymentData = paymentDoc.data()!;
    
    if (paymentData.status === 'completed') {
        console.log(`[webhook.ts] Pagamento ${localTransactionId} já foi processado. Ignorando.`);
        return res.status(200).json({ success: true, message: "Pagamento já processado." });
    }

    const { userId, planIds } = paymentData;

    if (!userId || !Array.isArray(planIds) || planIds.length === 0) {
      console.error('Dados inválidos ou incompletos no documento de pagamento do Firestore.', paymentData);
      throw new Error('Dados inválidos no Firestore: userId ou planIds ausentes/inválidos.');
    }

    const allPlans = await getPlansFromFirestoreAdmin(db);
    const selectedPlans = allPlans.filter(p => planIds.includes(p.id));

    if (selectedPlans.length !== planIds.length) {
      throw new Error(`Planos inválidos referenciados no pagamento ${localTransactionId}. IDs: ${planIds.join(', ')}`);
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`Usuário com UID ${userId} não encontrado no Firestore.`);
    }

    const userData = userDoc.data()!;
    const existingSubscriptions = userData.subscriptions || {};

    const batch = db.batch();

    for (const plan of selectedPlans) {
      const now = new Date();
      const currentSub = existingSubscriptions[plan.productId];
      
      const startDate = (currentSub && currentSub.status === 'active' && currentSub.expiresAt.toDate() > now) 
          ? currentSub.expiresAt.toDate() 
          : now;
          
      const expiresAt = new Date(startDate.getTime());
      expiresAt.setDate(expiresAt.getDate() + plan.days);

      existingSubscriptions[plan.productId] = {
        status: 'active',
        plan: plan.id,
        startedAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        lastTransactionId: pushinpayTransactionId,
      };
    }
    
    batch.update(userRef, { subscriptions: existingSubscriptions });
    
    batch.update(paymentRef, { 
      status: 'completed',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      pushinpayEndToEndId: params.get('end_to_end_id'),
    });

    await batch.commit();

    console.log(`Assinaturas atualizadas com sucesso para o usuário ${userId}`);
    
    await notifyAutomationSystem({
      userId,
      userEmail: userData?.email,
      userName: userData?.name || params.get('payer_name'),
      planIds,
      selectedPlans,
      transactionId: pushinpayTransactionId,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK ERROR !!!---', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}
