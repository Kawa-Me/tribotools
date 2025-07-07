
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
  const validation = CreatePixPaymentSchema.safeParse(input);

  if (!validation.success) {
    return { error: 'Dados inválidos.', details: validation.error.format() };
  }
  
  const { uid, plans: selectedPlanIds, name, email, document, phone } = validation.data;

  // Initialize Admin SDK and Firestore DB
  let db: admin.firestore.Firestore;
  try {
    initializeAdminApp();
    db = admin.firestore();
  } catch(error: any) {
    console.error('createPixPayment Error: Firestore Admin DB could not be initialized.', error.message);
    return { error: 'Erro de configuração do servidor: Serviço de banco de dados não configurado.' };
  }

  const apiToken = process.env.PUSHINPAY_API_TOKEN;
  if (!apiToken) {
    console.error('CRITICAL ERROR: PUSHINPAY_API_TOKEN environment variable not found!');
    return { error: 'Erro de configuração do servidor: Chave de API não encontrada.' };
  }
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error('CRITICAL ERROR: NEXT_PUBLIC_SITE_URL environment variable not found!');
    return { error: 'Erro de configuração do servidor: URL do site não encontrada.' };
  }

  try {
    const allPlans = await getPlansFromFirestoreAdmin();
    if (allPlans.length === 0) {
        return { error: 'Server configuration error: No plans found' };
    }
    
    const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));

    if (selectedPlans.length !== selectedPlanIds.length) {
      return { error: 'Um ou mais planos selecionados são inválidos.' };
    }

    const totalPrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);

    if (totalPrice > 150) {
      return { error: 'O valor total não pode exceder R$ 150,00.' };
    }

    const totalPriceInCents = Math.round(totalPrice * 100);

    const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
    const webhookUrl = `${siteUrl}/api/webhook`;
    
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 1);

    const paymentPayload = {
      name,
      email,
      document,
      phone,
      value: totalPriceInCents,
      webhook_url: webhookUrl,
      expires_at: expirationDate.toISOString(),
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(paymentPayload),
    });

    const data = await response.json();
    
    if (!response.ok || !data.id) {
        console.error('Pushin Pay API Error Response:', data);
        const apiErrorMessage = data.message || (data.errors ? JSON.stringify(data.errors) : `HTTP error! status: ${response.status}`);
        return { error: `Falha no provedor de pagamento: ${apiErrorMessage}` };
    }

    const transactionId = data.id;

    // --- Create pending payment record and update user info using ADMIN SDK ---
    const userRef = db.collection('users').doc(uid);
    const pendingPaymentRef = db.collection('pending_payments').doc(transactionId);

    await db.runTransaction(async (transaction) => {
        transaction.update(userRef, { name, document, phone });
        transaction.set(pendingPaymentRef, {
            userId: uid,
            planIds: selectedPlanIds,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            payerInfo: { name, email, document, phone }
        });
    });

    console.log(`✅ Successfully created pending_payment document with ID: ${transactionId} for user ${uid}`);

    if (!data.qr_code || !data.qr_code_base64) {
        console.error('Invalid success response from Pushin Pay. Expected "qr_code" and "qr_code_base64". Received:', data);
        const errorDetails = JSON.stringify(data);
        return { error: `O provedor retornou uma resposta inesperada. Detalhes: ${errorDetails}` };
    }

    const imageUrl = `data:image/png;base64,${data.qr_code_base64}`;

    return {
      qrcode_text: data.qr_code,
      qrcode_image_url: imageUrl,
    };

  } catch (error) {
    console.error(`Error creating Pix payment for user ${uid}. Details:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return { error: `Erro inesperado na comunicação: ${errorMessage}` };
  }
}
