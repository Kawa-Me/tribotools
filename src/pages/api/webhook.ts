
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { Plan, Product } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';
import querystring from 'querystring';
import { Buffer } from 'buffer';

// Helper to get raw body from request, necessary for x-www-form-urlencoded
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

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
    // A PushinPay envia como x-www-form-urlencoded, então precisamos parsear assim.
    const rawBody = await getRawBody(req);
    const body = querystring.parse(rawBody.toString('utf-8'));
    console.log('Webhook recebido e parseado:', body);
    
    // Validação corrigida: checa por status 'paid' e a presença de 'metadata'
    if (body.status !== 'paid' || !body.metadata) {
      console.log('Webhook ignorado: status não é "paid" ou faltam metadados.');
      return res.status(200).json({ message: 'Webhook ignorado: evento não relevante ou dados incompletos.' });
    }

    const transactionId = body.id as string;

    // A lib querystring pode retornar um array ou um único valor para metadata.
    const metadataArray = Array.isArray(body.metadata) ? body.metadata : [body.metadata];
    
    // O parse de querystring pode criar objetos aninhados de forma inesperada.
    // Esta função robusta extrai os valores 'name' e 'value' da estrutura.
    const extractedMeta: { [key: string]: string } = {};
    const regex = /metadata\[\d+\]\[(name|value)\]/;

    for(const key in body) {
        const match = key.match(regex);
        if (match) {
            // Ex: key = 'metadata[0][name]', body[key] = 'userId'
            // Ex: key = 'metadata[0][value]', body[key] = '...'
            // We need to pair them up.
            const index = key.match(/\[(\d+)\]/)?.[1];
            const prop = match[1]; // 'name' or 'value'
            if (index && prop) {
                // This logic is getting complex. Let's simplify.
                // It seems querystring does not handle this nesting well.
                // Let's assume the provider sends a more direct structure if possible,
                // or we adapt to what querystring gives us.
                // Let's check the provider's actual output via logs.
                // The log does not show metadata. This implies the sending was wrong.
                // By fixing the sending, we expect the receiving to be correct.
                // Let's assume the provider correctly returns a structured 'metadata' field now.
            }
    }
    
    // Vamos usar um método mais simples, confiando que a correção no `checkout.ts` vai funcionar.
    const metadataFromProvider = body.metadata as any[];
    const finalMeta: { [key: string]: string } = {};
     if (Array.isArray(metadataFromProvider)) {
        metadataFromProvider.forEach(item => {
            // O querystring pode aninhar 'name' e 'value' dentro de um objeto.
            if (item && typeof item === 'object' && item.name && item.value) {
                finalMeta[item.name] = item.value;
            }
        });
    }

    // Workaround for when querystring flattens the metadata array.
    if(Object.keys(finalMeta).length === 0) {
      const tempMeta: {[key: string]: {name?: string, value?: string}} = {};
      for (const key in body) {
          const match = key.match(/metadata\[(\d+)\]\[(name|value)\]/);
          if (match) {
              const index = match[1];
              const prop = match[2];
              if (!tempMeta[index]) tempMeta[index] = {};
              tempMeta[index][prop as 'name' | 'value'] = body[key] as string;
          }
      }
      Object.values(tempMeta).forEach(item => {
          if (item.name && item.value) {
              finalMeta[item.name] = item.value;
          }
      });
    }


    const userId = finalMeta.userId;
    const planIdsString = finalMeta.planIds;

    if (!userId || !planIdsString) {
      console.error('Metadados inválidos no webhook. Faltando userId ou planIds.', finalMeta);
      throw new Error('Metadados inválidos no webhook: userId ou planIds ausentes após o processamento.');
    }

    const planIds = JSON.parse(planIdsString);
     if (!Array.isArray(planIds) || planIds.length === 0) {
      console.error('planIds não é um array válido após o parse.', planIdsString);
      throw new Error('planIds deve ser um array com pelo menos um item.');
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
    
    batch.update(userRef, { subscriptions: existingSubscriptions });
    
    batch.update(userRef, {
        name: userData?.name || body.payer_name as string,
        document: userData?.document || body.payer_national_registration as string,
        phone: userData?.phone || body.phone as string,
    });

    await batch.commit();

    console.log(`Assinaturas atualizadas com sucesso para o usuário ${userId}`);
    
    await notifyAutomationSystem({
      userId,
      userEmail: userData?.email,
      userName: userData?.name || body.payer_name,
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
