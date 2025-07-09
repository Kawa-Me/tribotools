
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
    const productionWebhookUrl = process.env.N8N_WEBHOOK_URL;
    const testWebhookUrl = process.env.N8N_TEST_WEBHOOK_URL;

    // A helper function to send the webhook to avoid code duplication
    const sendWebhook = async (url: string, type: 'Production' | 'Test') => {
        console.log(`[webhook.ts] Attempting to send ${type} notification to n8n...`);
        console.log(`[webhook.ts] n8n ${type} Payload:`, JSON.stringify(payload, null, 2));

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`[webhook.ts] Successfully sent ${type} notification. Status: ${response.status}`);
            } else {
                const responseBody = await response.text();
                console.error(`[webhook.ts] Failed to send ${type} notification. Status: ${response.status}`);
                console.error(`[webhook.ts] n8n ${type} Response Body:`, responseBody);
            }
        } catch (error) {
            console.error(`[webhook.ts] CRITICAL: Exception caught while sending ${type} notification:`, error);
        }
    };

    // Send production webhook if configured
    if (productionWebhookUrl) {
        await sendWebhook(productionWebhookUrl, 'Production');
    } else {
        console.warn('[webhook.ts] N8N_WEBHOOK_URL is not configured. Skipping production notification.');
    }
    
    // Send test webhook if configured
    if (testWebhookUrl) {
        await sendWebhook(testWebhookUrl, 'Test');
    }
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const rawBody = await getRawBody(req);
    const rawBodyString = rawBody.toString('utf-8');
    console.log('[webhook.ts] --- Received Webhook ---');
    console.log('[webhook.ts] Raw Body:', rawBodyString);
    
    const params = new URLSearchParams(rawBodyString);
    
    const status = params.get('status')?.toLowerCase(); // Make it case-insensitive
    const pushinpayTransactionId = params.get('id');

    if (!status || !pushinpayTransactionId) {
        console.error('[webhook.ts] Webhook payload missing "status" or "id".', params.toString());
        return res.status(400).json({ error: 'Webhook payload missing required fields.' });
    }

    initializeAdminApp();
    const db = admin.firestore();
    
    const normalizedGatewayId = pushinpayTransactionId.toUpperCase();
    console.log(`[webhook.ts] Received webhook for transaction ${normalizedGatewayId} with status: ${status}`);
    
    // Give Firestore a moment to ensure data consistency, especially if the write was very recent.
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const paymentsQuery = db.collection('payments')
        .where('pushinpayTransactionId', '==', normalizedGatewayId)
        .limit(1);
        
    const querySnapshot = await paymentsQuery.get();

    if (querySnapshot.empty) {
        console.error(`[webhook.ts] Payment not found for pushinpayTransactionId: ${normalizedGatewayId}. Responding 404 to trigger a retry.`);
        return res.status(404).json({ error: 'Payment not found, please retry.' });
    }
    
    const paymentDoc = querySnapshot.docs[0];
    const paymentRef = paymentDoc.ref;
    const paymentData = paymentDoc.data()!;
    const { userId, planIds, userName, userEmail, userPhone } = paymentData;

    // --- PAID WEBHOOK LOGIC ---
    if (status === 'paid') {
      console.log(`[webhook.ts] Entering 'paid' logic for ${normalizedGatewayId}.`);
      if (paymentData.status === 'completed') {
        console.log(`[webhook.ts] Payment ${paymentRef.id} has already been processed as 'completed'. Ignoring.`);
        return res.status(200).json({ success: true, message: "Payment already processed." });
      }

      if (!userId || !Array.isArray(planIds) || planIds.length === 0) {
        throw new Error(`Invalid data in Firestore doc ${paymentRef.id}: userId or planIds missing.`);
      }

      const allPlans = await getPlansFromFirestoreAdmin(db);
      const selectedPlans = allPlans.filter(p => planIds.includes(p.id));

      if (selectedPlans.length !== planIds.length) {
        throw new Error(`Invalid plans referenced in payment ${paymentRef.id}.`);
      }

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) throw new Error(`User with UID ${userId} not found in Firestore.`);
      
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
        type: 'payment_success',
        userId, userEmail, userName, userPhone,
        planIds, selectedPlans,
        transactionId: normalizedGatewayId,
      });

    // --- REFUNDED/CHARGEBACK/CANCELLED WEBHOOK LOGIC ---
    } else if (status === 'refunded' || status === 'chargeback' || status === 'cancelled' || status === 'cancelado') {
        console.log(`[webhook.ts] Entering '${status}' logic for ${normalizedGatewayId}.`);
        if (!userId || !Array.isArray(planIds) || planIds.length === 0) {
            throw new Error(`Invalid data in Firestore doc ${paymentRef.id} for ${status}: userId or planIds missing.`);
        }
        
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error(`User with UID ${userId} not found in Firestore for ${status}.`);

        const userData = userDoc.data()!;
        const existingSubscriptions = userData.subscriptions || {};
        const batch = db.batch();
        const allPlans = await getPlansFromFirestoreAdmin(db);
        const selectedPlans = allPlans.filter(p => planIds.includes(p.id));

        for (const plan of selectedPlans) {
            console.log(`[webhook.ts] Checking product ${plan.productId} for cancellation...`);
            // Check if the subscription to be canceled is the one from this transaction
            if (existingSubscriptions[plan.productId]?.lastTransactionId === normalizedGatewayId) {
                console.log(`[webhook.ts] Match found! Cancelling subscription for product ${plan.productId}.`);
                existingSubscriptions[plan.productId].status = 'expired';
            } else {
                console.log(`[webhook.ts] No match for product ${plan.productId}. Current sub transaction ID: ${existingSubscriptions[plan.productId]?.lastTransactionId}. Webhook transaction ID: ${normalizedGatewayId}`);
            }
        }

        batch.update(userRef, { subscriptions: existingSubscriptions });
        batch.update(paymentRef, { 
            status: 'failed', 
            failureReason: `Pagamento revertido via webhook (${status})`,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();

        console.log(`[webhook.ts] Successfully processed subscription revocation for user ${userId} due to ${status}.`);
        
        await notifyAutomationSystem({
            type: 'payment_reversed',
            status: status,
            userId, userEmail, userName, userPhone,
            planIds, selectedPlans,
            transactionId: normalizedGatewayId,
        });

    } else {
        console.log(`[webhook.ts] Webhook with unhandled status "${status}" received for transaction ${normalizedGatewayId}. Ignoring.`);
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('---!!! [webhook.ts] FATAL WEBHOOK ERROR !!!---', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}
