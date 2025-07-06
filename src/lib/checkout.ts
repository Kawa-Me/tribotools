
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Product } from '@/lib/types';

// Helper to get plans directly from Firestore on the server
async function getPlansFromFirestore() {
  if (!db) return [];
  const productsSnapshot = await getDocs(collection(db, 'products'));
  const products = productsSnapshot.docs.map(doc => doc.data() as Product);
  return products.flatMap(p => 
    p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
  );
}

const CreatePixPaymentSchema = z.object({
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

  const { plans: selectedPlanIds, name, email, document, phone } = validation.data;

  const allPlans = await getPlansFromFirestore();
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

  const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
  const apiToken = process.env.PUSHINPAY_API_TOKEN;
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook`;

  if (!apiToken) {
    console.error('Pushin Pay API token is not configured.');
    return { error: 'Erro de configuração do servidor.' };
  }

  // The payment provider uses the 'name' field for the customer's name, but we also use it to track plans.
  // We'll combine them, and the webhook will parse the plan IDs from this string.
  const paymentName = `${name} | Tribo Tools - Plans:[${selectedPlanIds.join(',')}]`;

  const payload = {
    name: paymentName,
    email,
    document,
    phone,
    value: totalPrice,
    webhook: webhookUrl,
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error('Pushin Pay API Error:', data);
        const errorMessage = data.message || `HTTP error! status: ${response.status}`;
        return { error: `Falha ao se comunicar com o provedor de pagamento: ${errorMessage}` };
    }

    if (!data.qrcode_text || !data.qrcode_image_url) {
        console.error('Invalid response from Pushin Pay:', data);
        return { error: 'Resposta inválida do provedor de pagamento.' };
    }

    return {
      qrcode_text: data.qrcode_text,
      qrcode_image_url: data.qrcode_image_url,
    };

  } catch (error) {
    console.error('Error creating Pix payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return { error: `Erro inesperado: ${errorMessage}` };
  }
}
