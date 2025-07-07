// src/pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { IncomingMessage } from 'http';
import { Buffer } from 'buffer';
import type { Product } from '@/lib/types';

// Helper to initialize Firebase Admin SDK only once
const initializeAdminApp = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  try {
    // We need to parse the JSON string from the environment variable
    const serviceAccount = JSON.parse(serviceAccountString);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string.');
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${e.message}`);
  }
};

// Helper to get Plans using the Admin SDK
async function getPlansFromFirestoreAdmin(db: admin.firestore.Firestore) {
  const productsSnapshot = await db.collection('products').get();
  if (productsSnapshot.empty) return [];
  const products = productsSnapshot.docs.map(doc => doc.data() as Product);
  return products.flatMap(p => 
    p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
  );
}


function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', err => reject(err));
  });
}

// Disable the default body parser for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  let db: admin.firestore.Firestore;
  try {
    initializeAdminApp();
    db = admin.firestore();
  } catch(error: any) {
    console.error('Webhook Error: Firestore Admin DB could not be initialized.', error.message);
    return res.status(500).json({ error: 'Internal Server Error: Database service not configured.' });
  }

  try {
    const rawBodyBuffer = await getRawBody(req);
    const contentType = req.headers['content-type'] || '';
    
    console.log('🔥 Webhook recebido:', contentType);
    console.log('🟢 Raw Body:', rawBodyBuffer.toString('utf-8'));

    let bodyData: Record<string, any> = {};

    // The payload comes as x-www-form-urlencoded
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const parsed = new URLSearchParams(rawBodyBuffer.toString('utf-8'));
      for (const [key, value] of parsed.entries()) {
        bodyData[key] = value;
      }
    } else if (contentType.includes('application/json')) {
      // Also support JSON just in case
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

    // Find the pending payment using the transaction ID
    const paymentRef = db.collection('pending_payments').doc(transactionId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
        console.error(`Pending payment with ID ${transactionId} not found in database.`);
        return res.status(404).json({ error: 'Payment record not found.' });
    }

    const paymentData = paymentSnap.data()!;

    if (paymentData.status !== 'pending') {
        console.log(`Payment ${transactionId} already processed with status: ${paymentData.status}.`);
        return res.status(200).json({ success: true, message: 'Already processed.' });
    }

    const { userId, planIds } = paymentData;
    
    if (!userId || !planIds || planIds.length === 0) {
        console.error(`Invalid payment record for ${transactionId}: missing userId or planIds.`);
        await paymentRef.update({ status: 'error', error: 'Missing userId or planIds' });
        return res.status(400).json({ error: 'Invalid payment record.' });
    }

    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
        console.error(`User with ID ${userId} from payment ${transactionId} not found.`);
        await paymentRef.update({ status: 'error', error: 'User not found' });
        return res.status(404).json({ error: 'User not found.' });
    }
    
    const userData = userDocSnap.data()!;
    // Use the Admin SDK to fetch plans, bypassing security rules
    const allPlans = await getPlansFromFirestoreAdmin(db);
    
    if (allPlans.length === 0) {
        console.error(`Could not fetch plans from Firestore. Aborting activation for user ${userId}.`);
        await paymentRef.update({ status: 'error', error: 'Could not fetch plans from DB.' });
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
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        };
        changesMade = true;
      }
    }

    if (changesMade) {
        const batch = db.batch();
        batch.update(userDocRef, { subscriptions: newSubscriptions });
        batch.update(paymentRef, { status: 'completed', processedAt: admin.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        console.log(`✅ Access granted for user ${userId} for plans: ${planIds.join(', ')}.`);
    }

    // Post to n8n if URL is provided
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      console.log('🚀 Sending to n8n:', n8nWebhookUrl);
      // Use the info from the payment provider payload for n8n
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment_success',
          email: paymentData.payerInfo.email,
          name: bodyData.payer_name || paymentData.payerInfo.name,
          phone: paymentData.payerInfo.phone,
          document: bodyData.payer_national_registration || paymentData.payerInfo.document,
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
