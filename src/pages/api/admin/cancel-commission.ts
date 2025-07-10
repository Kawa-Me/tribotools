
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { initializeAdminApp } from '@/lib/firebase-admin';
import type { Payment, Affiliate } from '@/lib/types';

// Helper to notify n8n about commission cancellation.
async function notifyCommissionCancellation(payload: any) {
    const prodWebhookUrl = process.env.N8N_PROD_COMMISSION_CANCELLED_URL;
    const testWebhookUrl = process.env.N8N_TEST_COMMISSION_CANCELLED_URL;

    const sendWebhook = async (url: string, type: 'Production' | 'Test') => {
        console.log(`[cancel-commission] Attempting to send ${type} cancellation notification...`);
        console.log(`[cancel-commission] ${type} Payload:`, JSON.stringify(payload, null, 2));
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch(e) {
            console.error(`[cancel-commission] Failed to send ${type} cancellation notification to n8n:`, e);
        }
    };

    if (prodWebhookUrl) {
        await sendWebhook(prodWebhookUrl, 'Production');
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
    const app = initializeAdminApp();
    const auth = admin.auth(app);
    const db = admin.firestore(app);

    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
    const token = authorization.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const adminUid = decodedToken.uid;

    const adminUserDoc = await db.collection('users').doc(adminUid).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: User is not an admin.' });
    }

    const { paymentId } = req.body;
    if (!paymentId) {
        return res.status(400).json({ error: 'Bad Request: paymentId is required.' });
    }

    const paymentRef = db.collection('payments').doc(paymentId);
    let n8nPayload: any = {};
    
    await db.runTransaction(async (transaction) => {
        const paymentDoc = await transaction.get(paymentRef);
        if (!paymentDoc.exists) {
            throw new Error(`Payment with ID ${paymentId} not found.`);
        }
        
        const payment = paymentDoc.data() as Payment;

        if (payment.commissionStatus !== 'pending') {
            throw new Error(`Commission for payment ${paymentId} is not in 'pending' state. Current state: ${payment.commissionStatus}`);
        }

        if (!payment.affiliateId) {
            throw new Error(`Payment ${paymentId} does not have an associated affiliate.`);
        }

        const affiliatesQuery = db.collection("affiliates").where("ref_code", "==", payment.affiliateId).limit(1);
        const affiliateSnapshot = await transaction.get(affiliatesQuery);
        
        if (affiliateSnapshot.empty) {
            throw new Error(`Affiliate with ref_code ${payment.affiliateId} not found.`);
        }

        const affiliateDoc = affiliateSnapshot.docs[0];
        const affiliateRef = affiliateDoc.ref;
        const affiliateData = affiliateDoc.data() as Affiliate;
        const commissionAmount = payment.commission || 0;
        let balanceRevertedSuccessfully = false;

        if (commissionAmount > 0) {
             if (affiliateData.pending_balance >= commissionAmount) {
                transaction.update(affiliateRef, {
                    pending_balance: admin.firestore.FieldValue.increment(-commissionAmount),
                    total_earned: admin.firestore.FieldValue.increment(-commissionAmount),
                });
                balanceRevertedSuccessfully = true;
            } else {
                console.warn(`[cancel-commission] Cannot reverse R$${commissionAmount} from pending balance of R$${affiliateData.pending_balance} for affiliate ${payment.affiliateId}. Balance is insufficient.`);
                balanceRevertedSuccessfully = false;
            }
        }
        
        transaction.update(paymentRef, {
            commissionStatus: 'cancelled',
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        n8nPayload = {
            affiliate: {
              ref_code: affiliateData.ref_code,
              name: affiliateData.name,
              email: affiliateData.email,
              phone: affiliateData.phone || null,
            },
            buyer: {
              name: payment.userName,
              email: payment.userEmail,
              phone: payment.userPhone,
            },
            transaction: {
              localPaymentId: payment.id,
              gatewayTransactionId: payment.pushinpayTransactionId,
              commissionAmount: commissionAmount,
              cancellationDate: new Date().toISOString(),
              balance_reverted_successfully: balanceRevertedSuccessfully,
            }
        };
    });

    // Send the notification after the transaction is complete
    await notifyCommissionCancellation(n8pPayload);

    res.status(200).json({ success: true, message: 'Commission cancelled successfully.' });

  } catch (error: any) {
    console.error('---!!! ERROR in cancel-commission API !!!---', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return res.status(401).json({ error: 'Authentication token is invalid. Please log in again.' });
    }
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
