
'use server';

import { z } from 'zod';
import * as admin from 'firebase-admin';
import type { Product, Plan } from '@/lib/types';

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
  try {
    const validation = CreatePixPaymentSchema.safeParse(input);
    if (!validation.success) {
      console.error('[checkout.ts] Validation failed:', validation.error.format());
      return { error: 'Dados de formulário inválidos.', details: validation.error.format() };
    }
    
    const { uid, plans: selectedPlanIds, name, email, document, phone } = validation.data;

    const apiToken = process.env.PUSHINPAY_API_TOKEN;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!apiToken || !siteUrl) {
      return { error: 'Erro de configuração do servidor (faltando chaves de API).' };
    }
    
    // Initialize Firebase Admin to fetch plans securely
    const adminApp = initializeAdminApp();
    const db = admin.firestore();

    const allPlans = await getPlansFromFirestoreAdmin(db);
    const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));

    if (selectedPlans.length !== selectedPlanIds.length) {
      return { error: 'Um ou mais planos selecionados são inválidos.' };
    }

    const totalPrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);
    const totalPriceInCents = Math.round(totalPrice * 100);

    const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
    const webhookUrl = `${siteUrl}/api/webhook`;
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 1);

    // Your brilliant idea in action: passing metadata to the payment provider.
    const paymentPayload = {
      name,
      email,
      document,
      phone,
      value: totalPriceInCents,
      webhook_url: webhookUrl,
      expires_at: expirationDate.toISOString(),
      metadata: {
        userId: uid,
        planIds: selectedPlanIds,
      }
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${apiToken}` },
      body: JSON.stringify(paymentPayload),
    });

    const data = await response.json();
    
    if (!response.ok || !data.id) {
        const apiErrorMessage = data.message || (data.errors ? JSON.stringify(data.errors) : `HTTP error! status: ${response.status}`);
        throw new Error(`Falha no provedor de pagamento: ${apiErrorMessage}`);
    }
    
    // Success! Return the QR Code data to the frontend. No DB write needed here.
    const imageUrl = `data:image/png;base64,${data.qr_code_base64}`;
    return {
      qrcode_text: data.qr_code,
      qrcode_image_url: imageUrl,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`---!!! [checkout.ts] FATAL ERROR in createPixPayment: ${errorMessage} !!!---`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return { error: `Erro no servidor: ${errorMessage}` };
  }
}
