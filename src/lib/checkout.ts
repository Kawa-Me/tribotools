
'use server';

import { z } from 'zod';
import { allPlans, type PlanId } from '@/lib/plans';

const planIds = allPlans.map(p => p.id) as [PlanId, ...PlanId[]];

const CreatePixPaymentSchema = z.object({
  plans: z.array(z.enum(planIds)).min(1, { message: 'Selecione pelo menos um plano.' }),
  email: z.string().email(),
  phone: z.string().min(10),
});

type CreatePixPaymentInput = z.infer<typeof CreatePixPaymentSchema>;

export async function createPixPayment(input: CreatePixPaymentInput) {
  const validation = CreatePixPaymentSchema.safeParse(input);

  if (!validation.success) {
    return { error: 'Dados inválidos.', details: validation.error.format() };
  }

  const { plans, email, phone } = validation.data;
  
  const selectedPlans = allPlans.filter(p => plans.includes(p.id));

  if (selectedPlans.length !== plans.length) {
    return { error: 'Um ou mais planos selecionados são inválidos.' };
  }

  const totalPrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);

  // Server-side validation for the total amount
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

  // Create a parsable name for the webhook to identify the purchased plans
  const paymentName = `Tribo Tools - Plans:[${plans.join(',')}]`;

  const payload = {
    name: paymentName,
    email,
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
