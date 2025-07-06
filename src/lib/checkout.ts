
'use server';

import { z } from 'zod';

const plans = {
  mensal: { name: 'Acesso Mensal', price: 29.90 },
  trimestral: { name: 'Acesso Trimestral', price: 79.90 },
  anual: { name: 'Acesso Anual', price: 299.90 },
};

const CreatePixPaymentSchema = z.object({
  plan: z.enum(['mensal', 'trimestral', 'anual']),
  email: z.string().email(),
  phone: z.string().min(10),
});

type CreatePixPaymentInput = z.infer<typeof CreatePixPaymentSchema>;

export async function createPixPayment(input: CreatePixPaymentInput) {
  const validation = CreatePixPaymentSchema.safeParse(input);

  if (!validation.success) {
    return { error: 'Dados inválidos.', details: validation.error.format() };
  }

  const { plan, email, phone } = validation.data;
  const selectedPlan = plans[plan];

  const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
  const apiToken = process.env.PUSHINPAY_API_TOKEN;
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook`;

  if (!apiToken) {
    console.error('Pushin Pay API token is not configured.');
    return { error: 'Erro de configuração do servidor.' };
  }

  const payload = {
    name: `Tribo Tools - ${selectedPlan.name}`,
    email,
    phone,
    value: selectedPlan.price,
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
