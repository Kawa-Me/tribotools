
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { Plan, Product } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

// Helper para inicializar o Firebase Admin SDK apenas uma vez
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

// Helper para notificar seu sistema de automação (n8n)
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
  console.log('✅ Webhook do Pages Router está ativo');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const body = req.body;
    console.log('Webhook recebido:', body);
    
    // Validação dos dados essenciais do webhook
    if (body.type !== 'pix.cashin.received' || !body.data || !body.data.id || !body.data.metadata) {
      console.log('Webhook ignorado: tipo de evento não é "pix.cashin.received" ou faltam dados.');
      return res.status(200).json({ message: 'Webhook ignorado: evento não relevante.' });
    }

    const { userId, planIds } = body.data.metadata;
    const transactionId = body.data.id;

    if (!userId || !Array.isArray(planIds) || planIds.length === 0) {
      throw new Error('Metadados inválidos no webhook: userId ou planIds ausentes.');
    }

    initializeAdminApp();
    const db = admin.firestore();

    const allPlans = await getPlansFromFirestoreAdmin(db);
    const selectedPlans = allPlans.filter(p => planIds.includes(p.id));

    if (selectedPlans.length !== planIds.length) {
      throw new Error(`Planos inválidos recebidos no webhook. IDs: ${planIds.join(', ')}`);
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`Usuário com UID ${userId} não encontrado no Firestore.`);
    }

    const userData = userDoc.data();
    const existingSubscriptions = userData?.subscriptions || {};

    const batch = db.batch();

    for (const plan of selectedPlans) {
      const now = new Date();
      const expiresAt = new Date(now.getTime());
      expiresAt.setDate(expiresAt.getDate() + plan.days);

      existingSubscriptions[plan.productId] = {
        status: 'active',
        plan: plan.id,
        startedAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        lastTransactionId: transactionId,
      };
    }
    
    // Atualiza o documento do usuário com as novas assinaturas
    batch.update(userRef, { subscriptions: existingSubscriptions });
    
    // Atualiza os dados do cliente se ainda não existirem
    batch.update(userRef, {
        name: userData?.name || body.data.payer.name,
        document: userData?.document || body.data.payer.document,
        phone: userData?.phone || body.data.payer.phone,
    });

    await batch.commit();

    console.log(`Assinaturas atualizadas com sucesso para o usuário ${userId}`);
    
    await notifyAutomationSystem({
      userId,
      userEmail: userData?.email,
      userName: userData?.name || body.data.payer.name,
      planIds,
      selectedPlans,
      transactionId,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK ERROR !!!---', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}
