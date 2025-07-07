
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Product } from '@/lib/types';

export async function getPlansFromFirestore() {
  if (!db) return [];
  const productsSnapshot = await getDocs(collection(db, 'products'));
  const products = productsSnapshot.docs.map(doc => doc.data() as Product);
  return products.flatMap(p => 
    p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
  );
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

  if (!db) {
    return { error: 'Erro de configuração do servidor: Serviço de banco de dados indisponível.' };
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

  let allPlans;
  try {
    allPlans = await getPlansFromFirestore();
  } catch (e: any) {
      if (e.code === 'permission-denied') {
          console.error("Firestore permission denied in getPlansFromFirestore:", e);
          return { error: "Erro de permissão ao buscar planos. Verifique as regras de segurança do Firestore." };
      }
      console.error("Error fetching plans from Firestore:", e);
      const errorMessage = e.message || 'An unknown error occurred while fetching plans.';
      return { error: `Não foi possível carregar os planos do banco de dados: ${errorMessage}` };
  }

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

  try {
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

    // --- Create pending payment record and update user info ---
    const batch = writeBatch(db);

    // This convenience update is removed to diagnose the PERMISSION_DENIED error.
    // It's possible the user's rules don't allow updating their own profile.
    // const userRef = doc(db, 'users', uid);
    // batch.update(userRef, { name, document, phone });

    const pendingPaymentRef = doc(db, 'pending_payments', transactionId);
    batch.set(pendingPaymentRef, {
      userId: uid,
      planIds: selectedPlanIds,
      status: 'pending',
      createdAt: serverTimestamp(),
      payerInfo: { name, email, document, phone }
    });
    
    await batch.commit();
    // --- End of batch write ---

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
    console.error('Error creating Pix payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return { error: `Erro inesperado na comunicação: ${errorMessage}` };
  }
}
