
// src/app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Product } from '@/lib/types';
import { URLSearchParams } from 'url';

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
  } catch(error: any) {
    console.error('Webhook Error: Firestore Admin DB could not be initialized.', error.message);
    return NextResponse.json({ error: 'Internal Server Error: Database service not configured.' }, { status: 500 });
  }

  try {
    // FIX: The payload is `application/x-www-form-urlencoded`.
    // We will parse it manually from the raw text body to be robust.
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);
    const rawBody: { [key:string]: any } = Object.fromEntries(params.entries());

    console.log('📦 Parsed Webhook Body (x-www-form-urlencoded):', rawBody);

    // The 'metadata' field is sent as a JSON string within the form-data, so we need to parse it separately.
    let parsedMetadata;
    if (rawBody.metadata && typeof rawBody.metadata === 'string') {
      try {
        parsedMetadata = JSON.parse(rawBody.metadata);
      } catch (e) {
        console.error('Error parsing metadata from webhook:', rawBody.metadata, e);
        return NextResponse.json({ error: 'Invalid metadata format in webhook payload.' }, { status: 400 });
      }
    }

    const { status, id: transactionId, payer_name, payer_national_registration, value } = rawBody;

    if (status !== 'paid') {
      console.log(`Ignoring transaction ${transactionId} with status: ${status}`);
      return NextResponse.json({ success: true, message: `Event ignored, status is not 'paid'.` }, { status: 200 });
    }

    if (!parsedMetadata || !parsedMetadata.userId || !parsedMetadata.planIds) {
        console.error(`CRITICAL: Webhook for transaction ${transactionId} is missing or has malformed metadata. Cannot grant access.`, parsedMetadata);
        return NextResponse.json({ error: 'Webhook payload missing required metadata.' }, { status: 400 });
    }

    const { userId, planIds } = parsedMetadata;
    console.log(`Processing user ID: ${userId} for plans: ${planIds.join(', ')}`);
    
    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
        console.error(`User with ID ${userId} from transaction ${transactionId} not found.`);
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    
    const userData = userDocSnap.data()!;
    console.log(`Found user ${userData.email} to grant access to.`);
    
    const allPlans = await getPlansFromFirestoreAdmin(db);
    
    if (allPlans.length === 0) {
        console.error(`Could not fetch any plans from Firestore. Aborting activation for user ${userId}.`);
        return NextResponse.json({ error: 'Could not fetch plans from DB.' }, { status: 500 });
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
        console.log(`Prepared subscription grant for product '${plan.productName}' on plan '${plan.name}' for user ${userId}.`);
      } else {
        console.warn(`Plan with ID ${planId} from metadata not found in current plans. It might have been deleted.`);
      }
    }

    if (changesMade) {
        await userDocRef.update({ subscriptions: newSubscriptions });
        console.log(`✅ Access granted and user record updated for user ${userId}.`);
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      console.log('🚀 Sending to n8n webhook...');
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment_success',
          email: userData.email,
          name: payer_name || userData.name,
          phone: userData.phone,
          document: payer_national_registration || userData.document,
          planIds: planIds,
          amount: Number(value) / 100,
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
    const errorMessage = error.message || 'An unknown error occurred.';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
