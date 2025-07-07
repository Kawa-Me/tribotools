import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Product, Plan } from '@/lib/types';
import { addDays, Timestamp } from 'firebase/firestore';

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
async function getPlansFromFirestoreAdmin(db: admin.firestore.Firestore): Promise<Plan[]> {
  try {
    const productsSnapshot = await db.collection('products').get();
    if (productsSnapshot.empty) return [];
    const products = productsSnapshot.docs.map(doc => doc.data() as Product);
    return products.flatMap(p => 
      p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
    );
  } catch (error: any) {
    console.error("[webhook] Error fetching plans with Admin SDK:", error);
    throw new Error("Could not fetch plans from database.", { cause: error });
  }
}

// Function to notify your automation system (n8n)
async function notifyAutomation(data: any) {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
        console.warn('N8N_WEBHOOK_URL is not set. Skipping notification.');
        return;
    }

    try {
        await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        console.log('Successfully notified n8n webhook.');
    } catch (error) {
        console.error('---!!! Error notifying n8n webhook !!!---', error);
    }
}

// Main handler for the POST request
export async function POST(req: Request) {
    try {
        const bodyText = await req.text();
        const params = new URLSearchParams(bodyText);
        
        const eventId = params.get('id');
        const eventType = params.get('type');

        if (!eventId || !eventType) {
             return NextResponse.json({ error: 'Missing id or type in webhook payload' }, { status: 400 });
        }

        // We only care about successful PIX payments
        if (eventType !== 'pix.transaction.paid') {
            return NextResponse.json({ message: 'Event type not handled, skipping.' }, { status: 200 });
        }

        const apiToken = process.env.PUSHINPAY_API_TOKEN;
        if (!apiToken) {
            throw new Error('PUSHINPAY_API_TOKEN is not configured on the server.');
        }
        
        // Fetch the full transaction details from PushinPay
        const transactionUrl = `https://api.pushinpay.com.br/api/pix/cashIn/${eventId}`;
        const transactionResponse = await fetch(transactionUrl, {
            headers: { 'Authorization': `Bearer ${apiToken}`, 'Accept': 'application/json' },
        });

        if (!transactionResponse.ok) {
            const errorBody = await transactionResponse.text();
            throw new Error(`Failed to fetch transaction details from PushinPay: ${transactionResponse.status} ${errorBody}`);
        }

        const transaction = await transactionResponse.json();

        // The metadata we smartly sent earlier
        const metadata = transaction.metadata;
        if (!metadata || !metadata.userId || !metadata.planIds) {
            throw new Error(`Webhook for transaction ${eventId} is missing required metadata.`);
        }

        const { userId, planIds } = metadata;

        const adminApp = initializeAdminApp();
        const db = admin.firestore();

        const allPlans = await getPlansFromFirestoreAdmin(db);
        const purchasedPlans = allPlans.filter(p => planIds.includes(p.id));

        if (purchasedPlans.length === 0) {
            throw new Error(`No valid plans found for plan IDs: ${planIds.join(', ')}`);
        }
        
        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDoc.get();

        if (!userDoc.exists) {
            console.error(`User with UID ${userId} not found in Firestore. Cannot grant access.`);
            // Acknowledge the webhook to prevent retries, but log the severe issue.
            return NextResponse.json({ message: 'User not found, but webhook acknowledged.' }, { status: 200 });
        }

        const userData = userDoc.data()!;
        const existingSubscriptions = userData.subscriptions || {};

        // Update subscriptions
        purchasedPlans.forEach(plan => {
            const now = new Date();
            const currentSub = existingSubscriptions[(plan as any).productId];
            const currentExpiry = currentSub?.expiresAt?.toDate() > now ? currentSub.expiresAt.toDate() : now;
            
            existingSubscriptions[(plan as any).productId] = {
                status: 'active',
                plan: plan.id,
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: Timestamp.fromDate(addDays(currentExpiry, plan.days)),
            };
        });

        await db.runTransaction(async (t) => {
            t.update(userDocRef, { subscriptions: existingSubscriptions });
        });

        // Notify n8n for content liberation
        await notifyAutomation({
            email: userData.email,
            name: userData.name || 'Usuário',
            purchasedPlans: purchasedPlans.map(p => ({ id: p.id, name: p.name, productName: (p as any).productName })),
            status: 'paid'
        });

        return NextResponse.json({ success: true, message: 'User subscription updated.' }, { status: 200 });

    } catch (error: any) {
        console.error('---!!! FATAL WEBHOOK ERROR !!!---', error);
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}
