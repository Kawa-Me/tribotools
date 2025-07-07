
'use server';

import { z } from 'zod';
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
  try {
    const productsSnapshot = await db.collection('products').get();
    if (productsSnapshot.empty) return [];
    const products = productsSnapshot.docs.map(doc => doc.data() as Product);
    return products.flatMap(p => 
      p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
    );
  } catch (error: any) {
    console.error("[checkout.ts] Error fetching plans with Admin SDK:", error);
    throw new Error("Could not fetch plans from database.", { cause: error });
  }
}

const CreatePixPaymentSchema = z.object({
  uid: z.string(),
  plans: z.array(z.string()).min(1, { message: 'Selecione pelo menos um plano.' }),
  name: z.string().min(3),
  email: z.string().email(),
  document: z.string().min(11),
  phone: z.string().min(10),
});

type CreatePixPaymentInput = z.infer<typeof CreatePixPaymentSchema>;

export async function createPixPayment(input: CreatePixPaymentInput) {
  console.log('--- [checkout.ts] Received request to create PIX payment ---');

  try {
    const validation = CreatePixPaymentSchema.safeParse(input);
    if (!validation.success) {
      console.error('[checkout.ts] Validation failed:', validation.error.format());
      return { error: 'Dados inválidos.', details: validation.error.format() };
    }
    
    const { uid, plans: selectedPlanIds, name, email, document, phone } = validation.data;
    console.log(`[checkout.ts] Input validated for user: ${uid}`);

    const apiToken = process.env.PUSHINPAY_API_TOKEN;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    console.log(`[checkout.ts] Checking environment variables:`);
    console.log(`- PUSHINPAY_API_TOKEN: ${apiToken ? 'Loaded' : 'MISSING!'}`);
    console.log(`- NEXT_PUBLIC_SITE_URL: ${siteUrl ? 'Loaded' : 'MISSING!'}`);
    console.log(`- FIREBASE_SERVICE_ACCOUNT_KEY: ${serviceAccountKey ? 'Loaded' : 'MISSING!'}`);

    if (!apiToken || !siteUrl || !serviceAccountKey) {
      const missing = [
        !apiToken && 'PUSHINPAY_API_TOKEN',
        !siteUrl && 'NEXT_PUBLIC_SITE_URL',
        !serviceAccountKey && 'FIREBASE_SERVICE_ACCOUNT_KEY'
      ].filter(Boolean).join(', ');
      console.error(`[checkout.ts] CRITICAL ERROR: Missing environment variables: ${missing}`);
      return { error: 'Erro de configuração do servidor.' };
    }

    initializeAdminApp();
    const db = admin.firestore();
    console.log('[checkout.ts] Firebase Admin SDK initialized.');

    const allPlans = await getPlansFromFirestoreAdmin(db);
    console.log(`[checkout.ts] Fetched ${allPlans.length} total plans from Firestore.`);
    
    const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));

    if (selectedPlans.length !== selectedPlanIds.length) {
      console.error('[checkout.ts] Invalid plan ID detected.');
      return { error: 'Um ou mais planos selecionados são inválidos.' };
    }

    const totalPrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);
    const totalPriceInCents = Math.round(totalPrice * 100);
    console.log(`[checkout.ts] Total price calculated: R$${totalPrice.toFixed(2)} (${totalPriceInCents} cents)`);

    const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
    const webhookUrl = `${siteUrl}/api/webhook`;
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 1);

    const paymentPayload = { name, email, document, phone, value: totalPriceInCents, webhook_url: webhookUrl, expires_at: expirationDate.toISOString() };
    console.log('[checkout.ts] Sending payload to PushinPay:', JSON.stringify(paymentPayload));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${apiToken}` },
      body: JSON.stringify(paymentPayload),
    });

    const data = await response.json();
    
    if (!response.ok || !data.id) {
        console.error('[checkout.ts] PushinPay API Error Response:', data);
        const apiErrorMessage = data.message || (data.errors ? JSON.stringify(data.errors) : `HTTP error! status: ${response.status}`);
        throw new Error(`Falha no provedor de pagamento: ${apiErrorMessage}`);
    }
    
    const transactionId = data.id;
    console.log(`[checkout.ts] PushinPay API success. Transaction ID: ${transactionId}`);

    const pendingPaymentRef = db.collection('pending_payments').doc(transactionId);
    const paymentData = {
        userId: uid,
        planIds: selectedPlanIds,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        payerInfo: { name, email, document, phone }
    };
    console.log(`[checkout.ts] Preparing to write to Firestore with data:`, JSON.stringify(paymentData));
    
    await pendingPaymentRef.set(paymentData);
    
    console.log(`✅ [checkout.ts] Successfully created pending_payment document with ID: ${transactionId} for user ${uid}`);

    const imageUrl = `data:image/png;base64,${data.qr_code_base64}`;

    return {
      qrcode_text: data.qr_code,
      qrcode_image_url: imageUrl,
    };

  } catch (error) {
    console.error('---!!! [checkout.ts] FATAL ERROR in createPixPayment !!!---');
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(errorMessage);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return { error: `Erro inesperado no servidor: ${errorMessage}` };
  }
}
