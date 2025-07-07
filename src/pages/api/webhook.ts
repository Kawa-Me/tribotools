
// src/pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import { getPlansFromFirestore } from '@/lib/checkout';
import type { IncomingMessage } from 'http';
import { Buffer } from 'buffer';

function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', err => reject(err));
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  if (!db) {
      console.error('Webhook Error: Firestore DB is not initialized.');
      return res.status(500).json({ error: 'Internal Server Error: Database service not configured.' });
  }

  try {
    const rawBodyBuffer = await getRawBody(req);
    const contentType = req.headers['content-type'] || '';
    
    console.log('🔥 Webhook recebido:', contentType);
    console.log('🟢 Raw Body:', rawBodyBuffer.toString('utf-8'));

    let bodyData: Record<string, any> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const parsed = new URLSearchParams(rawBodyBuffer.toString('utf-8'));
      for (const [key, value] of parsed.entries()) {
        bodyData[key] = value;
      }
    } else if (contentType.includes('application/json')) {
      bodyData = JSON.parse(rawBodyBuffer.toString('utf-8'));
    } else {
      console.error(`Unsupported content type: ${contentType}`);
      return res.status(415).json({ error: `Unsupported content type: ${contentType}` });
    }

    console.log('📦 Parsed BodyData:', bodyData);

    const transactionId = bodyData.id;
    const transactionStatus = bodyData.status;

    if (!transactionId) {
        console.error('Webhook payload missing transaction ID (field "id").');
        return res.status(400).json({ error: 'Transaction ID not found in payload.' });
    }

    if (transactionStatus !== 'paid') {
      console.log(`Ignoring transaction ${transactionId} with status: ${transactionStatus}`);
      return res.status(200).json({ success: true, message: 'Event ignored, status is not "paid".' });
    }

    const paymentRef = doc(db, 'pending_payments', transactionId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
        console.error(`Pending payment with ID ${transactionId} not found in database.`);
        return res.status(404).json({ error: 'Payment record not found.' });
    }

    const paymentData = paymentSnap.data();

    if (paymentData.status !== 'pending') {
        console.log(`Payment ${transactionId} already processed with status: ${paymentData.status}.`);
        return res.status(200).json({ success: true, message: 'Already processed.' });
    }

    const { userId, planIds, payerInfo } = paymentData;
    
    if (!userId || !planIds || planIds.length === 0) {
        console.error(`Invalid payment record for ${transactionId}: missing userId or planIds.`);
        await paymentRef.ref.update({ status: 'error', error: 'Missing userId or planIds' });
        return res.status(400).json({ error: 'Invalid payment record.' });
    }

    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        console.error(`User with ID ${userId} from payment ${transactionId} not found.`);
        await paymentRef.ref.update({ status: 'error', error: 'User not found' });
        return res.status(404).json({ error: 'User not found.' });
    }
    
    const userData = userDocSnap.data();
    // Fetch live plans from Firestore instead of using a static list
    const allPlans = await getPlansFromFirestore();
    
    if (allPlans.length === 0) {
        console.error(`Could not fetch plans from Firestore. Aborting activation for user ${userId}.`);
        await paymentRef.ref.update({ status: 'error', error: 'Could not fetch plans from DB.' });
        return res.status(500).json({ error: 'Could not fetch plans.' });
    }

    const newSubscriptions = { ...(userData.subscriptions || {}) };
    let changesMade = false;

    for (const planId of planIds) {
      const plan = allPlans.find(p => p.id === planId);
      if (plan) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.days);

        newSubscriptions[plan.productId] = {
          status: 'active',
          plan: plan.id,
          startedAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiresAt),
        };
        changesMade = true;
      }
    }

    if (changesMade) {
        const batch = writeBatch(db);
        batch.update(userDocRef, { subscriptions: newSubscriptions });
        batch.update(paymentRef, { status: 'completed', processedAt: serverTimestamp() });
        await batch.commit();
        console.log(`✅ Access granted for user ${userId} for plans: ${planIds.join(', ')}.`);
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      console.log('🚀 Sending to n8n:', n8nWebhookUrl);
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment_success',
          email: payerInfo.email,
          name: payerInfo.name,
          phone: payerInfo.phone,
          document: payerInfo.document,
          planIds: planIds,
          amount: Number(bodyData.value) / 100,
          paymentDate: new Date().toISOString(),
          transactionId: transactionId,
        }),
      }).catch(err => {
        console.error('❌ Failed to send to n8n:', err);
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK ERROR !!!---');
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
