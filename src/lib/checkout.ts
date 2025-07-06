
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

  // --- Based on your n8n example, the API expects the value in cents (integer)
  const totalPriceInCents = Math.round(totalPrice * 100);

  const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
  const apiToken = process.env.PUSHINPAY_API_TOKEN;
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook`;

  // --- DEBUG LOGGING ---
  console.log('--- Iniciando Geração de PIX ---');
  if (apiToken) {
    console.log('API Token encontrado. Primeiros 5 caracteres:', apiToken.substring(0, 5));
  } else {
    console.error('ERRO CRÍTICO: Variável de ambiente PUSHINPAY_API_TOKEN não encontrada!');
    return { error: 'Erro de configuração do servidor: Chave de API não encontrada.' };
  }
  // --- END DEBUG LOGGING ---

  // --- The user's n8n example uses `webhook_url`. Let's use that.
  // --- Also adding an expiration date, as in the example.
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + 1); // 1 hour expiration

  // The payment provider uses the 'name' field for the customer's name, but we also use it to track plans.
  // We'll combine them, and the webhook will parse the plan IDs from this string.
  const paymentName = `${name} | Tribo Tools - Plans:[${selectedPlanIds.join(',')}]`;

  const payload = {
    name: paymentName,
    email,
    document,
    phone,
    value: totalPriceInCents, // Sending value in cents
    webhook_url: webhookUrl, // Corrected field name
    expires_at: expirationDate.toISOString(), // Adding expiration
  };

  // --- NEW DEBUG LOGGING ---
  console.log('--- Enviando Payload para PushInPay ---');
  console.log(JSON.stringify(payload, null, 2));
  // --- END NEW DEBUG LOGGING ---

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // Adding Accept header as in your example
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
