
'use server';

import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { initializeAdminApp } from '@/lib/firebase-admin';
import type { Plan, Product, Payment, Affiliate } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

// Helper to notify n8n when balance is automatically released
async function notifyBalanceReleased(payload: any) {
    const prodWebhookUrl = process.env.N8N_PROD_BALANCE_RELEASED_URL;
    const testWebhookUrl = process.env.N8N_TEST_BALANCE_RELEASED_URL;

    const sendWebhook = async (url: string, type: 'Production' | 'Test') => {
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch(e) {
            console.error(`[CRON] Failed to send ${type} balance released notification to n8n:`, e);
        }
    };

    if (prodWebhookUrl) {
        await sendWebhook(prodWebhookUrl, 'Production');
    }
    if (testWebhookUrl) {
        await sendWebhook(testWebhookUrl, 'Test');
    }
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

// Function to process a successful payment, can be reused
async function processSuccessfulPayment(db: admin.firestore.Firestore, paymentRef: admin.firestore.DocumentReference, paymentData: Payment) {
    const { userId, planIds, pushinpayTransactionId } = paymentData;
    if (!userId || !Array.isArray(planIds) || planIds.length === 0 || !pushinpayTransactionId) {
      console.error(`[CRON] Invalid data in Firestore doc ${paymentRef.id}: critical data missing.`);
      return;
    }

    const allPlans = await getPlansFromFirestoreAdmin(db);
    const selectedPlans = allPlans.filter(p => planIds.includes(p.id));

    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
            console.error(`[CRON] User with UID ${userId} not found in Firestore. Cannot grant subscription.`);
            throw new Error(`User ${userId} not found.`);
        }

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
              lastTransactionId: pushinpayTransactionId,
            };
        }

        transaction.update(userRef, { subscriptions: existingSubscriptions });
        transaction.update(paymentRef, {
            status: 'completed',
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`[CRON] Successfully updated subscriptions for user ${userId} for payment ${paymentRef.id}`);
}

async function releaseCommissions(db: admin.firestore.Firestore) {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const commissionsToReleaseQuery = db.collection('payments')
        .where('commissionStatus', '==', 'pending')
        .where('createdAt', '<=', Timestamp.fromDate(twoDaysAgo));
        
    const snapshot = await commissionsToReleaseQuery.get();

    if (snapshot.empty) {
        return { releasedCount: 0 };
    }

    const affiliatesToUpdate: { [key: string]: number } = {};
    const paymentsToUpdateRefs: admin.firestore.DocumentReference[] = [];

    snapshot.docs.forEach(doc => {
        const payment = doc.data() as Payment;
        if (payment.affiliateId && payment.commission && payment.commission > 0) {
            if (!affiliatesToUpdate[payment.affiliateId]) {
                affiliatesToUpdate[payment.affiliateId] = 0;
            }
            affiliatesToUpdate[payment.affiliateId] += payment.commission;
            paymentsToUpdateRefs.push(doc.ref);
        }
    });

    for (const affiliateId in affiliatesToUpdate) {
        const amountToRelease = affiliatesToUpdate[affiliateId];
        const affiliatesQuery = db.collection('affiliates').where('ref_code', '==', affiliateId).limit(1);
        const affiliateSnapshot = await affiliatesQuery.get();
        
        if (!affiliateSnapshot.empty) {
            const affiliateDoc = affiliateSnapshot.docs[0];
            const affiliateRef = affiliateDoc.ref;
            const affiliateData = affiliateDoc.data() as Affiliate;

            await db.runTransaction(async (transaction) => {
                transaction.update(affiliateRef, {
                    pending_balance: admin.firestore.FieldValue.increment(-amountToRelease),
                    available_balance: admin.firestore.FieldValue.increment(amountToRelease),
                });
            });

            // Notify n8n for automatic payout
            await notifyBalanceReleased({
                affiliate: {
                    ref_code: affiliateData.ref_code,
                    name: affiliateData.name,
                    email: affiliateData.email,
                    phone: affiliateData.phone || null,
                    pix_key: affiliateData.pix_key,
                    pix_type: affiliateData.pix_type,
                },
                payout: {
                    amount: amountToRelease,
                    released_at: new Date().toISOString(),
                }
            });
        }
    }
    
    const batch = db.batch();
    paymentsToUpdateRefs.forEach(ref => {
        batch.update(ref, { commissionStatus: 'released' });
    });
    await batch.commit();

    return { releasedCount: paymentsToUpdateRefs.length };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiToken = process.env.PUSHINPAY_API_TOKEN;
  const cronSecret = process.env.CRON_SECRET;

  if (!apiToken || !cronSecret) {
      console.error("[CRON] Server configuration error: PUSHINPAY_API_TOKEN or CRON_SECRET is not set.");
      return res.status(503).json({ error: 'Service Unavailable: Server is not configured correctly.' });
  }
  
  const app = initializeAdminApp();
  const auth = admin.auth(app);
  const db = admin.firestore(app);
  
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  const token = authorization.split('Bearer ')[1];
  
  if (token !== cronSecret) {
    try {
        const decodedToken = await auth.verifyIdToken(token);
        const adminUserDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (!adminUserDoc.exists || adminUserDoc.data()?.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: User is not an admin.' });
        }
    } catch (error) {
        console.error('[CRON] Auth token verification failed:', error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const docsToDelete: admin.firestore.QueryDocumentSnapshot[] = [];
    
    // --- Step 1: Automated Cleanup of old payments ---
    const allPendingSnapshot = await db.collection('payments').where('status', '==', 'pending').get();
    const allFailedSnapshot = await db.collection('payments').where('status', '==', 'failed').get();
    
    const recentDocsToCheck: admin.firestore.QueryDocumentSnapshot[] = [];

    // Filter pending payments for cleanup or checking
    allPendingSnapshot.forEach(doc => {
      const createdAt = doc.data().createdAt as admin.firestore.Timestamp | undefined;
      // Keep pending payments for 7 days
      if (createdAt && createdAt.toDate() < sevenDaysAgo) {
        docsToDelete.push(doc);
      } else {
        recentDocsToCheck.push(doc);
      }
    });

    // Filter failed payments for cleanup
    allFailedSnapshot.forEach(doc => {
      const createdAt = doc.data().createdAt as admin.firestore.Timestamp | undefined;
      // Clean up failed payments after 1 day
      if (createdAt && createdAt.toDate() < oneDayAgo) {
        docsToDelete.push(doc);
      }
    });
    
    let cleanedCount = 0;
    if (docsToDelete.length > 0) {
      const batch = db.batch();
      docsToDelete.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      cleanedCount = docsToDelete.length;
      console.log(`[CRON] Cleaned up ${cleanedCount} abandoned pending/failed payments.`);
    }

    // --- Step 2: Check status of recent pending payments ---
    let checkedCount = 0;
    let updatedCount = 0;
    if (recentDocsToCheck.length > 0) {
        for (const doc of recentDocsToCheck) {
          checkedCount++;
          const paymentData = doc.data() as Payment;
          const pushinpayTransactionId = paymentData.pushinpayTransactionId;

          if (!pushinpayTransactionId) {
            console.warn(`[CRON] Pending payment ${doc.id} is missing a pushinpayTransactionId. Skipping.`);
            continue;
          }

          const response = await fetch(`https://api.pushinpay.com.br/api/transactions/${pushinpayTransactionId}`, {
            headers: { 'Authorization': `Bearer ${apiToken}`, 'Accept': 'application/json' },
          });

          if (!response.ok) {
            console.error(`[CRON] Failed to fetch status for transaction ${pushinpayTransactionId}. Status: ${response.status}`);
            if (response.status === 404) {
                 await doc.ref.update({
                    status: 'failed',
                    failureReason: `Transaction not found on PushinPay (404). Verified via cron job.`,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                updatedCount++;
            }
            continue;
          }

          const transactionDetails = await response.json();
          const newStatus = transactionDetails.status?.toLowerCase();
          const expirationDateStr = transactionDetails.pix_details?.expiration_date;

          let isExpired = false;
          if (expirationDateStr) {
              const expirationDate = new Date(expirationDateStr.replace(' ', 'T') + 'Z');
              if (!isNaN(expirationDate.getTime()) && new Date() > expirationDate) {
                  isExpired = true;
              }
          }

          if ((newStatus && newStatus !== 'pending' && newStatus !== 'created') || isExpired) {
              updatedCount++;
              if (newStatus === 'paid') {
                console.log(`[CRON] Transaction ${pushinpayTransactionId} is now 'paid'. Processing...`);
                await processSuccessfulPayment(db, doc.ref, paymentData);
              } else {
                const failureReason = isExpired
                  ? `Pagamento expirado. Verificado via cron job.`
                  : `Status atualizado para '${newStatus}' pelo cron job.`;
                
                console.log(`[CRON] Transaction ${pushinpayTransactionId} has failed with reason: ${failureReason}. Updating...`);
                await doc.ref.update({
                  status: 'failed',
                  failureReason: failureReason,
                  processedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
          }
        }
    }

    // --- Step 3: Release commissions older than 2 days ---
    const { releasedCount } = await releaseCommissions(db);
    if (releasedCount > 0) {
      console.log(`[CRON] Released ${releasedCount} commissions.`);
    }

    res.status(200).json({ 
        message: 'Cron job completed successfully.', 
        checked: checkedCount, 
        updated: updatedCount, 
        cleaned: cleanedCount,
        commissionsReleased: releasedCount
    });

  } catch (error: any) {
    console.error('---!!! ERROR in check-pending-payments CRON !!!---', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
