
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

  if (siteUrl.includes('localhost')) {
      console.warn(`
        --- AVISO DE DESENVOLVIMENTO ---
        Você está usando um endereço localhost para o webhook: ${webhookUrl}
        O provedor de pagamento (PushInPay) não conseguirá acessar este endereço.
        A liberação automática de acesso NÃO funcionará no ambiente local.
        Isto é esperado. Em produção, com uma URL pública, o webhook funcionará normalmente.
        --- FIM DO AVISO ---
      `);
  }

  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + 1);

  const paymentName = `${email}|${name}|Tribo Tools - Plans:[${selectedPlanIds.join(',')}]`;

  const payload = {
    name,
    email,
    document,
    phone,
    value: totalPriceInCents,
    webhook_url: webhookUrl,
    expires_at: expirationDate.toISOString(),
    description: paymentName, // Using description to pass our metadata
  };

  console.log("Enviando payload para PushInPay:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("Resposta recebida da PushInPay:", JSON.stringify(data, null, 2));
    
    if (!response.ok) {
        console.error('Pushin Pay API Error Response:', data);
        const apiErrorMessage = data.message || (data.errors ? JSON.stringify(data.errors) : `HTTP error! status: ${response.status}`);
        return { error: `Falha no provedor de pagamento: ${apiErrorMessage}` };
    }

    // Check for the new expected fields: qr_code (text) and qr_code_base64 (image)
    if (!data.qr_code || !data.qr_code_base64) {
        console.error('Invalid success response from Pushin Pay. Expected "qr_code" and "qr_code_base64". Received:', data);
        const errorDetails = JSON.stringify(data);
        return { error: `O provedor retornou uma resposta inesperada. Detalhes: ${errorDetails}` };
    }

    // The API returns a base64 string for the image. We need to format it as a data URI.
    const imageUrl = `data:image/png;base64,${data.qr_code_base64}`;

    return {
      qrcode_text: data.qr_code, // This is the "copia e cola" text
      qrcode_image_url: imageUrl, // This is the QR code image
    };

  } catch (error) {
    console.error('Error creating Pix payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return { error: `Erro inesperado na comunicação: ${errorMessage}` };
  }
}
