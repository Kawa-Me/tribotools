
'use server';

import { z } from 'zod';
import * as admin from 'firebase-admin';
import type { Product, Plan, Coupon } from '@/lib/types';
import { initializeAdminApp } from '@/lib/firebase-admin';

// Helper to get Plans using the Admin SDK
async function getPlansFromFirestoreAdmin(db: admin.firestore.Firestore): Promise<(Plan & {productId: string, productName: string})[]> {
  try {
    const productsSnapshot = await db.collection('products').get();
    if (productsSnapshot.empty) return [];
    const products = productsSnapshot.docs.map(doc => doc.data() as Product);
    return products.flatMap(p => 
      p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
    );
  } catch (error: any)
{
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
  couponCode: z.string().optional().nullable(),
});

type CreatePixPaymentInput = z.infer<typeof CreatePixPaymentSchema>;

export async function createPixPayment(input: CreatePixPaymentInput) {
  try {
    const validation = CreatePixPaymentSchema.safeParse(input);
    if (!validation.success) {
      console.error('[checkout.ts] Validation failed:', validation.error.format());
      return { error: 'Dados de formulário inválidos.', details: validation.error.format() };
    }
    
    const { uid, plans: selectedPlanIds, name, email, document, phone, couponCode } = validation.data;

    const apiToken = process.env.PUSHINPAY_API_TOKEN;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!apiToken || !siteUrl) {
      return { error: 'Erro de configuração do servidor (faltando chaves de API).' };
    }
    
    const adminApp = initializeAdminApp();
    const db = admin.firestore();

    const allPlans = await getPlansFromFirestoreAdmin(db);
    const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));
    if (selectedPlans.length !== selectedPlanIds.length) {
      return { error: 'Um ou mais planos selecionados são inválidos.' };
    }
    const basePrice = selectedPlans.reduce((sum, plan) => sum + plan.price, 0);

    let finalPrice = basePrice;
    let discountAmount = 0;
    let appliedCoupon: Coupon | null = null;
    
    if (couponCode) {
      const couponRef = db.collection('coupons').doc(couponCode);
      const couponDoc = await couponRef.get();
      
      if (couponDoc.exists) {
        const coupon = { id: couponDoc.id, ...couponDoc.data() } as Coupon;
        const now = admin.firestore.Timestamp.now();

        if (coupon.isActive && now >= coupon.startDate && now <= coupon.endDate) {
          appliedCoupon = coupon;
           const applicablePlans = selectedPlans.filter(plan => 
            !coupon.applicableProductIds || coupon.applicableProductIds.length === 0 || coupon.applicableProductIds.includes(plan.productId)
          );
          const eligiblePrice = applicablePlans.reduce((sum, plan) => sum + plan.price, 0);
          discountAmount = eligiblePrice * (coupon.discountPercentage / 100);
          finalPrice = basePrice - discountAmount;
        } else {
          return { error: 'O cupom fornecido não é mais válido.' };
        }
      } else {
        return { error: 'O cupom fornecido não existe.' };
      }
    }

    const totalPriceInCents = Math.round(finalPrice * 100);
    if (totalPriceInCents < 100) {
        return { error: 'O valor final da transação não pode ser inferior a R$ 1,00.' };
    }

    const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
    const webhookUrl = `${siteUrl}/api/webhook`;

    // STEP 1: Call PushinPay API first to get their transaction ID.
    const paymentPayload = {
      value: totalPriceInCents,
      payer: { name, document, email, phone },
      webhook_url: webhookUrl,
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
    
    // STEP 2: Now, create the local payment record in a SINGLE write operation.
    const paymentRef = db.collection('payments').doc();
    const gatewayTransactionId = data.id.toUpperCase();

    await paymentRef.set({
      id: paymentRef.id, // Store its own ID for reference
      userId: uid,
      userEmail: email,
      userName: name,
      userPhone: phone,
      planIds: selectedPlanIds,
      basePrice: basePrice,
      appliedCoupon: appliedCoupon ? { id: appliedCoupon.id, discountPercentage: appliedCoupon.discountPercentage } : null,
      discountAmount: discountAmount,
      totalPrice: finalPrice,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      pushinpayTransactionId: gatewayTransactionId,
    });
    console.log(`[checkout.ts] Created pending payment record ${paymentRef.id} for PushinPay ID ${gatewayTransactionId}`);

    const imageUrl = `data:image/png;base64,${data.qr_code_base64}`;
    return {
      qrcode_text: data.qr_code,
      qrcode_image_url: imageUrl,
      paymentId: gatewayTransactionId, // Return the gateway ID to the client
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
