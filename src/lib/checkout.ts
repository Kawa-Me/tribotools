
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
async function getPlansFromFirestoreAdmin() {
  try {
    const db = admin.firestore();
    const productsSnapshot = await db.collection('products').get();
    if (productsSnapshot.empty) return [];
    const products = productsSnapshot.docs.map(doc => doc.data() as Product);
    return products.flatMap(p => 
      p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
    );
  } catch (error: any) {
    console.error("Error fetching plans with Admin SDK:", error);
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
  console.log('--- Starting createPixPayment ---');
  console.log('Checking for Service Account Key:', !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'Found' : 'MISSING!');
  console.log('Checking for PushinPay API Token:', !!process.env.PUSHINPAY_API_TOKEN ? 'Found' : 'MISSING!');
  console.log('Checking for Site URL:', !!process.env.NEXT_PUBLIC_SITE_URL ? 'Found' : 'MISSING!');

  const validation = CreatePixPaymentSchema.safeParse(input);

  if (!validation.success) {
    console.error('Validation failed:', validation.error.format());
    return { error: 'Dados inválidos.', details: validation.error.format() };
  }
  
  const { uid, plans: selectedPlanIds, name, email, document, phone } = validation.data;
  console.log(`Input validated for user: ${uid}`);

  // Initialize Admin SDK and Firestore DB
  let db: admin.firestore.Firestore;
  try {
    initializeAdminApp();
    db = admin.firestore();
    console.log('Firebase Admin SDK initialized successfully.');
  } catch(error: any) {
    console.error('createPixPayment Error: Firestore Admin DB could not be initialized.', error.message);
    return { error: 'Erro de configuração do servidor: Serviço de banco de dados não configurado.' };
  }

  const apiToken = process.env.PUSHINPAY_API_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  
  if (!apiToken || !siteUrl) {
    console.error('CRITICAL ERROR: Missing environment variables.');
    return { error: 'Erro de configuração do servidor: Chaves de API ou URL do site não encontradas.' };
  }

  try {
    console.log('Fetching plans from Firestore...');
    const allPlans = await getPlansFromFirestoreAdmin();
    if (allPlans.length === 0) {
        console.error('Server configuration error: No plans found in Firestore.');
        return { error: 'Server configuration error: No plans found' };
    }
    console.log('Plans fetched successfully.');
    
    const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));

    if (selectedPlans.length !== selectedPlanIds.length) {
      console.error('Invalid plan ID detected.');
      return { error: 'Um ou mais planos selecionados são inválidos.' };
    }

    const totalPrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);
    const totalPriceInCents = Math.round(totalPrice * 100);
    console.log(`Total price calculated: R$${totalPrice.toFixed(2)} (${totalPriceInCents} cents)`);

    const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
    const webhookUrl = `${siteUrl}/api/webhook`;
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 1);

    const paymentPayload = { name, email, document, phone, value: totalPriceInCents, webhook_url: webhookUrl, expires_at: expirationDate.toISOString() };
    console.log('Sending payload to PushinPay:', paymentPayload);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${apiToken}` },
      body: JSON.stringify(paymentPayload),
    });

    const data = await response.json();
    
    if (!response.ok || !data.id) {
        console.error('PushinPay API Error Response:', data);
        const apiErrorMessage = data.message || (data.errors ? JSON.stringify(data.errors) : `HTTP error! status: ${response.status}`);
        return { error: `Falha no provedor de pagamento: ${apiErrorMessage}` };
    }
    
    console.log('Received successful response from PushinPay. Transaction ID:', data.id);
    const transactionId = data.id;

    // --- Create pending payment record ---
    console.log('Attempting to create pending_payment document in Firestore...');
    try {
        const pendingPaymentRef = db.collection('pending_payments').doc(transactionId);
        await pendingPaymentRef.set({
            userId: uid,
            planIds: selectedPlanIds,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            payerInfo: { name, email, document, phone }
        });
        console.log(`✅ Successfully created pending_payment document with ID: ${transactionId} for user ${uid}`);
    } catch (firestoreError: any) {
        console.error('---!!! FIRESTORE WRITE FAILED !!!---');
        console.error(`Error writing pending_payment document for transaction ${transactionId}:`, firestoreError);
        console.error(`Error Code: ${firestoreError.code}, Message: ${firestoreError.message}`);
        return { error: 'Não foi possível registrar seu pedido no banco de dados. Contate o suporte.', details: firestoreError.message };
    }

    const imageUrl = `data:image/png;base64,${data.qr_code_base64}`;

    return {
      qrcode_text: data.qr_code,
      qrcode_image_url: imageUrl,
    };

  } catch (error) {
    console.error(`FATAL ERROR in createPixPayment for user ${uid}. Details:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return { error: `Erro inesperado na comunicação: ${errorMessage}` };
  }
}
