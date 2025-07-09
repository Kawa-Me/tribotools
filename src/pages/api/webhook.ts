
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { Plan, Product } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read the body of the request manually.
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

// Helper to fetch plans from Firestore with the Admin SDK
async function getPlansFromFirestoreAdmin(db: admin.firestore.Firestore): Promise<(Plan & { productId: string, productName: string })[]> {
  const productsSnapshot = await db.collection('products').get();
  if (productsSnapshot.empty) return [];
  const products = productsSnapshot.docs.map(doc => doc.data() as Product);
  return products.flatMap(p => 
    p.plans.map(plan => ({ ...plan, productId: p.id, productName: p.name }))
  );
}

// Helper to notify your automation system (n8n).
async function notifyAutomationSystem(payload: any) {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
        console.warn('[webhook.ts] N8N_WEBHOOK_URL is not configured. Skipping notification.');
        return;
    }

    console.log('[webhook.ts] Attempting to send notification to n8n via GET...');
    console.log('[webhook.ts] n8n Payload:', JSON.stringify(payload, null, 2));

    try {
        const params = new URLSearchParams();
        
        // Handle simple fields
        if (payload.userId) params.append('userId', payload.userId);
        if (payload.userEmail) params.append('userEmail', payload.userEmail);
        if (payload.userName) params.append('userName', payload.userName);
        if (payload.transactionId) params.append('transactionId', payload.transactionId);

        // Handle arrays and objects by stringifying them
        if (payload.planIds && Array.isArray(payload.planIds)) {
            // n8n GET usually works better with comma-separated values for arrays
            params.append('planIds', payload.planIds.join(','));
        }
        if (payload.selectedPlans && Array.isArray(payload.selectedPlans)) {
            params.append('selectedPlans', JSON.stringify(payload.selectedPlans));
        }
        
        // Remove the query string from the base URL if it exists to avoid conflicts
        const baseUrl = n8nWebhookUrl.split('?')[0];
        const fullUrl = `${baseUrl}?${params.toString()}`;

        console.log(`[webhook.ts] Sending GET request to: ${fullUrl}`);

        const response = await fetch(fullUrl, {
            method: 'GET',
        });

        if (response.ok) {
            console.log(`[webhook.ts] Successfully sent notification to n8n. Status: ${response.status}`);
        } else {
            const responseBody = await response.text();
            console.error(`[webhook.ts] Failed to send notification to n8n. Status: ${response.status}`);
            console.error('[webhook.ts] n8n Response Body:', responseBody);
        }
    } catch (error) {
        console.error('[webhook.ts] CRITICAL: Exception caught while sending notification to n8n:', error);
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
    
    const pushinpayTransactionId = params.get('id');
    if (!pushinpayTransactionId) {
          console.error('[webhook.ts] CRITICAL: Webhook payload is missing transaction identifier.');
          return res.status(400).json({ error: 'Webhook payload is missing transaction identifier.' });
    }
    
    const normalizedGatewayId = pushinpayTransactionId.toUpperCase(); // Normalize incoming ID to uppercase
    console.log(`[webhook.ts] Querying by normalized pushinpayTransactionId: ${normalizedGatewayId}`);
    
    // This pause helps mitigate race conditions on Vercel's cold starts.
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const paymentsQuery = db.collection('payments')
        .where('pushinpayTransactionId', '==', normalizedGatewayId)
        .limit(1);
        
    const querySnapshot = await paymentsQuery.get();

    if (querySnapshot.empty) {
        console.error(`[webhook.ts] Payment not found for pushinpayTransactionId: ${normalizedGatewayId} even after delay. This could be a race condition. Responding 404 to trigger a retry from PushinPay.`);
        return res.status(404).json({ error: 'Payment not found, please retry.' });
    }
    
    const paymentDoc = querySnapshot.docs[0];
    const paymentRef = paymentDoc.ref;
    
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
        planId: plan.id,
        startedAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        lastTransactionId: normalizedGatewayId,
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
      transactionId: normalizedGatewayId,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('---!!! [webhook.ts] FATAL WEBHOOK ERROR !!!---', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}
