
'use server';

import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { Plan, Product, Affiliate } from '@/lib/types';
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
async function notifyPurchaseApproved(payload: any) {
    const productionWebhookUrl = process.env.N8N_PROD_PURCHASE_APPROVED_URL;
    const testWebhookUrl = process.env.N8N_TEST_PURCHASE_APPROVED_URL;

    // A helper function to send the webhook to avoid code duplication
    const sendWebhook = async (url: string, type: 'Production' | 'Test') => {
        console.log(`[webhook.ts] Attempting to send ${type} purchase notification to n8n...`);
        console.log(`[webhook.ts] n8n ${type} Payload:`, JSON.stringify(payload, null, 2));

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`[webhook.ts] Successfully sent ${type} purchase notification. Status: ${response.status}`);
            } else {
                const responseBody = await response.text();
                console.error(`[webhook.ts] Failed to send ${type} purchase notification. Status: ${response.status}`);
                console.error(`[webhook.ts] n8n ${type} Response Body:`, responseBody);
            }
        } catch (error) {
            console.error(`[webhook.ts] CRITICAL: Exception caught while sending ${type} purchase notification:`, error);
        }
    };

    if (productionWebhookUrl) {
        await sendWebhook(productionWebhookUrl, 'Production');
    }
    
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
    
    // PushinPay sends form-urlencoded data, not JSON.
    const params = new URLSearchParams(rawBodyString);
    const status = params.get('status')?.toLowerCase();
    const pushinpayTransactionId = params.get('id');

    if (!status || !pushinpayTransactionId) {
        console.error('[webhook.ts] Webhook payload missing "status" or "id".', params.toString());
        return res.status(400).json({ error: 'Webhook payload missing required fields.' });
    }

    initializeAdminApp();
    const db = admin.firestore();
    
    const normalizedGatewayId = pushinpayTransactionId.toUpperCase();
    console.log(`[webhook.ts] Received webhook for transaction ${normalizedGatewayId} with status: ${status}`);
    
    // Give Firestore a moment to ensure data consistency
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
    const { userId, planIds, userName, userEmail, userPhone, affiliateId, totalPrice } = paymentDoc.data()!;
    
    // Fetch all plans once before entering the transaction
    const allPlans = await getPlansFromFirestoreAdmin(db);

    if (status === 'paid') {
      let commission = 0;
      let affiliateData: Affiliate | null = null;
      let affiliateRef: admin.firestore.DocumentReference | null = null;

      if (affiliateId) {
        const affiliatesQuery = db.collection('affiliates').where('ref_code', '==', affiliateId).limit(1);
        const affiliateSnapshot = await affiliatesQuery.get();

        if (!affiliateSnapshot.empty) {
            const affiliateDoc = affiliateSnapshot.docs[0];
            affiliateRef = affiliateDoc.ref;
            affiliateData = affiliateDoc.data() as Affiliate;
            const commissionPercent = affiliateData.commission_percent || 0;
            const rawCommission = (totalPrice * commissionPercent) / 100;
            commission = Math.floor(rawCommission * 100) / 100;
        } else {
            console.warn(`[webhook.ts] Affiliate with ref_code ${affiliateId} not found, but was on the payment. Commission will be 0.`);
        }
      }

      await db.runTransaction(async (transaction) => {
        const freshPaymentDoc = await transaction.get(paymentRef);
        if (!freshPaymentDoc.exists || freshPaymentDoc.data()?.status === 'completed') {
            console.log(`[webhook.ts] Payment ${paymentRef.id} is already processed as 'completed'. Ignoring transaction.`);
            return;
        }

        const paymentData = freshPaymentDoc.data()!;
        const { userId, planIds } = paymentData;
        if (!userId || !Array.isArray(planIds) || planIds.length === 0) {
            throw new Error(`Invalid data in Firestore doc ${paymentRef.id}: userId or planIds missing.`);
        }

        const selectedPlans = allPlans.filter(p => planIds.includes(p.id));
        if (selectedPlans.length !== planIds.length) {
            throw new Error(`Invalid plans referenced in payment ${paymentRef.id}.`);
        }

        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error(`User with UID ${userId} not found in Firestore.`);
        
        const userData = userDoc.data()!;
        const existingSubscriptions = userData.subscriptions || {};

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
        
        transaction.update(userRef, { subscriptions: existingSubscriptions });
        
        const updatePayload: any = { 
            status: 'completed',
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            pushinpayEndToEndId: params.get('end_to_end_id'),
        };

        if (affiliateRef && commission > 0) {
            updatePayload.commission = commission;
            updatePayload.commissionStatus = 'pending';
            
            transaction.update(affiliateRef, {
                pending_balance: admin.firestore.FieldValue.increment(commission),
                total_earned: admin.firestore.FieldValue.increment(commission)
            });
            console.log(`[webhook.ts] Credited R$${commission.toFixed(2)} to affiliate ${affiliateId}.`);
        }

        transaction.update(paymentRef, updatePayload);
      });

      console.log(`[webhook.ts] Successfully updated subscriptions for user ${userId}`);
      
      const notificationPayload = {
        type: 'payment_success',
        userId,
        userEmail,
        userName,
        userPhone,
        planIds,
        selectedPlans: allPlans.filter(p => planIds.includes(p.id)),
        transactionId: normalizedGatewayId,
        affiliate: affiliateData ? {
            id: affiliateId,
            name: affiliateData.name,
            pix_key: affiliateData.pix_key,
        } : null,
        commission
      };
      await notifyPurchaseApproved(notificationPayload);

    } else {
        // --- DEFAULT FAILURE/REVERSAL LOGIC ---
        const ignoredStatuses = ['created', 'pending'];
        if (ignoredStatuses.includes(status)) {
            console.log(`[webhook.ts] Ignoring intermediate status '${status}'.`);
            return res.status(200).json({ success: true, message: `Ignoring intermediate status: ${status}` });
        }

        await db.runTransaction(async (transaction) => {
            const freshPaymentDoc = await transaction.get(paymentRef);
            if (!freshPaymentDoc.exists || freshPaymentDoc.data()?.status === 'failed') {
                console.log(`[webhook.ts] Payment ${paymentRef.id} is already 'failed'. Ignoring reversal transaction.`);
                return;
            }

            const paymentData = freshPaymentDoc.data()!;
            const { userId, planIds, affiliateId, commission } = paymentData;

            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);
            
            if (userDoc.exists) {
                const userData = userDoc.data()!;
                const existingSubscriptions = userData.subscriptions || {};
                let subscriptionsUpdated = false;

                const productIdsToRevoke = new Set(
                    allPlans.filter(p => planIds.includes(p.id)).map(p => p.productId)
                );

                for (const productId of productIdsToRevoke) {
                    const sub = existingSubscriptions[productId];
                    // CRUCIAL CHECK: Only revoke if this specific transaction granted the access.
                    if (sub && sub.status === 'active' && sub.lastTransactionId === normalizedGatewayId) {
                        existingSubscriptions[productId].status = 'expired';
                        subscriptionsUpdated = true;
                    }
                }
                
                if (subscriptionsUpdated) {
                    transaction.update(userRef, { subscriptions: existingSubscriptions });
                }
            } else {
                console.error(`[webhook.ts] User ${userId} not found for reversal. Payment will be marked as failed, but subscription cannot be revoked.`);
            }
            
            const updatePayload: any = {
                status: 'failed',
                failureReason: `Pagamento revertido via webhook (status: ${status})`,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                pushinpayEndToEndId: params.get('end_to_end_id'),
            };

            if (affiliateId) {
                updatePayload.commissionStatus = 'cancelled';
                
                if (paymentData.commissionStatus === 'pending' && commission > 0) {
                    const affiliatesQuery = db.collection('affiliates').where('ref_code', '==', affiliateId).limit(1);
                    const affiliateSnapshot = await affiliatesQuery.get();
                    if (!affiliateSnapshot.empty) {
                        const affiliateRef = affiliateSnapshot.docs[0].ref;
                        transaction.update(affiliateRef, {
                            pending_balance: admin.firestore.FieldValue.increment(-commission),
                            total_earned: admin.firestore.FieldValue.increment(-commission)
                        });
                        console.log(`[webhook.ts] Reversed commission of R$${commission.toFixed(2)} from affiliate ${affiliateId}.`);
                    }
                }
            }

            transaction.update(paymentRef, updatePayload);
        });

        console.log(`[webhook.ts] Successfully processed reversal for ${paymentRef.id}.`);
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('---!!! [webhook.ts] FATAL WEBHOOK ERROR !!!---', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}
