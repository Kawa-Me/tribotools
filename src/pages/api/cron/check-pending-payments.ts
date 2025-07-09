'use server';

import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { initializeAdminApp } from '@/lib/firebase-admin';
import type { Plan, Product, Payment } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

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
    const { userId, planIds } = paymentData;
    if (!userId || !Array.isArray(planIds) || planIds.length === 0) {
      console.error(`[CRON] Invalid data in Firestore doc ${paymentRef.id}: userId or planIds missing.`);
      return;
    }

    const allPlans = await getPlansFromFirestoreAdmin(db);
    const selectedPlans = allPlans.filter(p => planIds.includes(p.id));

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        console.error(`[CRON] User with UID ${userId} not found in Firestore.`);
        return;
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
          lastTransactionId: paymentData.pushinpayTransactionId,
        };
    }

    batch.update(userRef, { subscriptions: existingSubscriptions });
    batch.update(paymentRef, {
        status: 'completed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    console.log(`[CRON] Successfully updated subscriptions for user ${userId} for payment ${paymentRef.id}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const app = initializeAdminApp();
    const db = admin.firestore(app);

    const pendingPaymentsSnapshot = await db.collection('payments')
      .where('status', '==', 'pending')
      .get();

    if (pendingPaymentsSnapshot.empty) {
      return res.status(200).json({ message: 'No pending payments to check.', checked: 0, updated: 0 });
    }

    const apiToken = process.env.PUSHINPAY_API_TOKEN;
    if (!apiToken) {
      throw new Error("PUSHINPAY_API_TOKEN is not configured on the server.");
    }

    let checkedCount = 0;
    let updatedCount = 0;

    for (const doc of pendingPaymentsSnapshot.docs) {
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
        // If the transaction is not found (404), it might be too old or invalid. Mark as failed.
        if (response.status === 404) {
             await doc.ref.update({
                status: 'failed',
                failureReason: `Transaction not found on PushinPay (404).`,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            updatedCount++;
        }
        continue;
      }

      const transactionDetails = await response.json();
      const newStatus = transactionDetails.status?.toLowerCase();

      if (newStatus && newStatus !== 'pending' && newStatus !== 'created') {
        updatedCount++;
        if (newStatus === 'paid') {
          console.log(`[CRON] Transaction ${pushinpayTransactionId} is now 'paid'. Processing...`);
          await processSuccessfulPayment(db, doc.ref, paymentData);
        } else {
          // Any other status (cancelled, refunded, failed, etc.) is considered a failure.
          console.log(`[CRON] Transaction ${pushinpayTransactionId} has failed with status '${newStatus}'. Updating...`);
          await doc.ref.update({
            status: 'failed',
            failureReason: `Status updated to '${newStatus}' by cron job.`,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    res.status(200).json({ message: 'Cron job completed successfully.', checked: checkedCount, updated: updatedCount });

  } catch (error: any) {
    console.error('---!!! ERROR in check-pending-payments CRON !!!---', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
