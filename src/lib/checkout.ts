
'use server';

import { z } from 'zod';
import * as admin from 'firebase-admin';
import type { Product, Plan } from '@/lib/types';

// Helper to initialize Firebase Admin SDK only once
const initializeAdminApp = () => {
  console.log('[Admin SDK] Attempting to initialize...');

  if (admin.apps.length > 0) {
    console.log('[Admin SDK] Already initialized.');
    return admin.app();
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    console.error('[Admin SDK] CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is NOT SET.');
    throw new Error('Server configuration error: Service account key is missing.');
  }
  console.log('[Admin SDK] Service account key environment variable is present.');

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    console.log(`[Admin SDK] Successfully parsed service account key for project: ${serviceAccount.project_id}`);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('[Admin SDK] CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string with no newlines or extra characters.');
    console.error(`[Admin SDK] Parser error: ${e.message}`);
    throw new Error(`Failed to initialize admin app due to invalid service account key: ${e.message}`);
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
  try {
    console.log('[checkout.ts] Function entry point. Validating input...');
    const validation = CreatePixPaymentSchema.safeParse(input);
    if (!validation.success) {
      console.error('[checkout.ts] Validation failed:', validation.error.format());
      return { error: 'Dados de formulário inválidos.', details: validation.error.format() };
    }
    
    const { uid, plans: selectedPlanIds, name, email, document, phone } = validation.data;
    console.log(`[checkout.ts] Input validated for user: ${uid}`);

    const apiToken = process.env.PUSHINPAY_API_TOKEN;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!apiToken || !siteUrl) {
      console.error(`[checkout.ts] CRITICAL ERROR: Missing PUSHINPAY_API_TOKEN or NEXT_PUBLIC_SITE_URL`);
      return { error: 'Erro de configuração do servidor (faltando chaves de API).' };
    }
    console.log('[checkout.ts] API token and Site URL are present.');

    // Initialize Firebase Admin here to catch errors early
    const adminApp = initializeAdminApp();
    const db = admin.firestore();
    console.log('[checkout.ts] Firebase Admin SDK initialized successfully.');

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
    
    console.log('[checkout.ts] Sending payload to PushinPay...');
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

    // --- CRITICAL STEP: WRITE TO FIRESTORE BEFORE RETURNING ---
    try {
      const pendingPaymentRef = db.collection('pending_payments').doc(transactionId);
      const paymentData = {
          userId: uid,
          planIds: selectedPlanIds,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          payerInfo: { name, email, document, phone }
      };
      
      console.log(`[checkout.ts] ATTEMPTING to write pending_payment doc ID: ${transactionId}`);
      await pendingPaymentRef.set(paymentData);
      console.log(`✅ [checkout.ts] SUCCESS: pending_payment document created.`);

      // --- ONLY RETURN QR CODE ON SUCCESS ---
      const imageUrl = `data:image/png;base64,${data.qr_code_base64}`;
      return {
        qrcode_text: data.qr_code,
        qrcode_image_url: imageUrl,
      };

    } catch (firestoreError: any) {
        console.error(`---!!! [checkout.ts] CRITICAL FIRESTORE WRITE ERROR !!!---`);
        const firestoreErrorMessage = `Code: ${firestoreError.code}. Message: ${firestoreError.message}`;
        console.error(`Failed to write pending_payment document. Details: ${firestoreErrorMessage}`);
        // This throw will be caught by the outer catch block
        throw new Error(`Falha ao registrar o pedido no banco de dados. ${firestoreErrorMessage}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`---!!! [checkout.ts] FATAL ERROR in createPixPayment: ${errorMessage} !!!---`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return { error: `Erro no servidor: ${errorMessage}` };
  }
}
