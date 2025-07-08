
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { Plan, Product } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

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
        console.warn('[webhook.ts] N8N_WEBHOOK_URL is not configured. Skipping notification.');
        return;
    }
    try {
        await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        console.log('[webhook.ts] Successfully sent notification to automation system.');
    } catch (error) {
        console.error('[webhook.ts] Failed to send notification to automation system:', error);
    }
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const rawBody = await getRawBody(req);
    const params = new URLSearchParams(rawBody.toString('utf-8'));
    
    const status = params.get('status');
    if (status !== 'paid') {
      console.log(`[webhook.ts] Webhook ignored: status is "${status}", not "paid".`);
      return res.status(200).json({ message: 'Webhook ignored: event not relevant.' });
    }
    
    initializeAdminApp();
    const db = admin.firestore();
    let paymentRef: admin.firestore.DocumentReference | null = null;
    let paymentDoc: admin.firestore.DocumentSnapshot | null = null;
    
    const localTransactionIdFromOrder = params.get('order_id');

    if (localTransactionIdFromOrder) {
      console.log(`[webhook.ts] Local ID received via order_id: ${localTransactionIdFromOrder}`);
      paymentRef = db.collection('payments').doc(localTransactionIdFromOrder);
      paymentDoc = await paymentRef.get();
    } else {
      const pushinpayTransactionId = params.get('id');
      if (!pushinpayTransactionId) {
           console.error('[webhook.ts] CRITICAL: Webhook payload is missing transaction identifier.');
           return res.status(400).json({ error: 'Webhook payload is missing transaction identifier.' });
      }
      
      console.log(`[webhook.ts] order_id not found. Querying by pushinpayTransactionId: ${pushinpayTransactionId}`);
      
      // --- ROBUST FALLBACK WITH DELAY ---
      // This delay gives Firestore time to sync the pushinpayTransactionId written by checkout.ts
      console.log(`[webhook.ts] Fallback initiated. Waiting 2 seconds for DB to sync...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const paymentsQuery = db.collection('payments')
          .where('pushinpayTransactionId', '==', pushinpayTransactionId)
          .orderBy('createdAt', 'desc')
          .limit(1);
          
      const querySnapshot = await paymentsQuery.get();

      if (querySnapshot.empty) {
          console.error(`[webhook.ts] Payment not found for pushinpayTransactionId: ${pushinpayTransactionId} even after delay. This could be a race condition. Responding 404 to trigger a retry from PushinPay.`);
          return res.status(404).json({ error: 'Payment not found, please retry.' });
      }
      
      paymentDoc = querySnapshot.docs[0];
      paymentRef = paymentDoc.ref;
    }
    
    if (!paymentDoc || !paymentDoc.exists) {
      console.error(`[webhook.ts] Payment document with ID ${paymentRef?.id} not found in payments collection. This should not happen.`);
      return res.status(404).json({ error: `Payment document ${paymentRef?.id} not found, please retry.` });
    }
    
    const paymentData = paymentDoc.data()!;
    
    if (paymentData.status === 'completed') {
        console.log(`[webhook.ts] Payment ${paymentRef.id} has already been processed. Ignoring.`);
        return res.status(200).json({ success: true, message: "Payment already processed." });
    }

    const { userId, planIds } = paymentData;
    if (!userId || !Array.isArray(planIds) || planIds.length === 0) {
      console.error('[webhook.ts] Invalid or incomplete data in the Firestore payment document.', paymentData);
      throw new Error('Invalid data in Firestore: userId or planIds are missing/invalid.');
    }

    const allPlans = await getPlansFromFirestoreAdmin(db);
    const selectedPlans = allPlans.filter(p => planIds.includes(p.id));

    if (selectedPlans.length !== planIds.length) {
      throw new Error(`Invalid plans referenced in payment ${paymentRef.id}. IDs: ${planIds.join(', ')}`);
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`User with UID ${userId} not found in Firestore.`);
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
        lastTransactionId: params.get('id'),
      };
    }
    
    batch.update(userRef, { subscriptions: existingSubscriptions });
    batch.update(paymentRef, { 
      status: 'completed',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      pushinpayEndToEndId: params.get('end_to_end_id'),
    });
    await batch.commit();

    console.log(`[webhook.ts] Successfully updated subscriptions for user ${userId}`);
    
    await notifyAutomationSystem({
      userId,
      userEmail: userData?.email,
      userName: userData?.name || params.get('payer_name'),
      planIds,
      selectedPlans,
      transactionId: params.get('id'),
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('---!!! [webhook.ts] FATAL WEBHOOK ERROR !!!---', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}
