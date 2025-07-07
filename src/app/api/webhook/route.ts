
// src/app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
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

// The new App Router API Route handler
export async function POST(req: Request) {
  console.log('--- Webhook POST request received ---');
  let db: admin.firestore.Firestore;
  try {
    initializeAdminApp();
    db = admin.firestore();
    console.log('Webhook: Firebase Admin SDK initialized.');
  } catch(error: any) {
    console.error('Webhook Error: Firestore Admin DB could not be initialized.', error.message);
    return NextResponse.json({ error: 'Internal Server Error: Database service not configured.' }, { status: 500 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    console.log('🔥 Webhook content-type:', contentType);

    const rawBody = await req.text();
    console.log('🟢 Raw Body:', rawBody);

    let bodyData: Record<string, any> = {};

    // The payload comes as x-www-form-urlencoded
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const parsed = new URLSearchParams(rawBody);
      for (const [key, value] of parsed.entries()) {
        bodyData[key] = value;
      }
    } else if (contentType.includes('application/json')) {
      // Also support JSON just in case
      bodyData = JSON.parse(rawBody);
    } else {
      console.error(`Unsupported content type: ${contentType}`);
      return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 415 });
    }

    console.log('📦 Parsed BodyData:', bodyData);

    const transactionId = bodyData.id;
    const transactionStatus = bodyData.status;

    if (!transactionId) {
        console.error('Webhook payload missing transaction ID (field "id").');
        return NextResponse.json({ error: 'Transaction ID not found in payload.' }, { status: 400 });
    }
     console.log(`Processing transaction ID: ${transactionId} with status: ${transactionStatus}`);

    if (transactionStatus !== 'paid') {
      console.log(`Ignoring transaction ${transactionId} with status: ${transactionStatus}`);
      return NextResponse.json({ success: true, message: 'Event ignored, status is not "paid".' }, { status: 200 });
    }

    // Find the pending payment using the transaction ID
    const paymentRef = db.collection('pending_payments').doc(transactionId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
        console.error(`CRITICAL: Pending payment with ID ${transactionId} not found in database. The user may have paid, but the system can't grant access.`);
        return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
    }

    const paymentData = paymentSnap.data()!;
    console.log('Found pending payment record:', paymentData);

    if (paymentData.status !== 'pending') {
        console.log(`Payment ${transactionId} already processed with status: ${paymentData.status}. Ignoring duplicate webhook.`);
        return NextResponse.json({ success: true, message: 'Already processed.' }, { status: 200 });
    }

    const { userId, planIds } = paymentData;
    
    if (!userId || !planIds || planIds.length === 0) {
        console.error(`Invalid payment record for ${transactionId}: missing userId or planIds.`);
        await paymentRef.update({ status: 'error', error: 'Missing userId or planIds' });
        return NextResponse.json({ error: 'Invalid payment record.' }, { status: 400 });
    }

    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
        console.error(`User with ID ${userId} from payment ${transactionId} not found.`);
        await paymentRef.update({ status: 'error', error: 'User not found' });
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    
    const userData = userDocSnap.data()!;
    console.log(`Found user ${userData.email} to grant access to.`);
    
    // Use the Admin SDK to fetch plans, bypassing security rules
    const allPlans = await getPlansFromFirestoreAdmin(db);
    
    if (allPlans.length === 0) {
        console.error(`Could not fetch plans from Firestore. Aborting activation for user ${userId}.`);
        await paymentRef.update({ status: 'error', error: 'Could not fetch plans from DB.' });
        return NextResponse.json({ error: 'Could not fetch plans.' }, { status: 500 });
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
        console.log(`Prepared subscription grant for product '${plan.productId}' on plan '${plan.name}' for user ${userId}.`);
      }
    }

    if (changesMade) {
        const batch = db.batch();
        batch.update(userDocRef, { subscriptions: newSubscriptions });
        batch.update(paymentRef, { status: 'completed', processedAt: admin.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        console.log(`✅ Access granted and payment record updated for user ${userId}.`);
    }

    // Post to n8n if URL is provided
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      console.log('🚀 Sending to n8n webhook:', n8nWebhookUrl);
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
        console.error('❌ Failed to send data to n8n:', err);
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK ERROR !!!---');
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
