'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { initialProducts } from '@/lib/plans';

export async function POST(request: Request) {
  console.log('--- WEBHOOK RECEIVED ---');

  let contentType = request.headers.get('content-type') || '';
  let formData: URLSearchParams | null = null;
  let bodyData: any = null;

  try {
    const rawBody = await request.text();
    console.log(`Raw Body Received:\n${rawBody}`);

    if (contentType.includes('application/json')) {
      bodyData = JSON.parse(rawBody);
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('text/plain')
    ) {
      formData = new URLSearchParams(rawBody);
    } else {
      console.warn(`Unsupported Content-Type: ${contentType}`);
    }

    // 🔄 Convert formData em bodyData (se necessário)
    if (!bodyData && formData) {
      bodyData = {};
      for (const [key, value] of formData.entries()) {
        bodyData[key] = value;
      }
    }

    if (!bodyData) {
      return NextResponse.json({ error: 'Corpo da requisição inválido ou vazio' }, { status: 400 });
    }

    const eventType = bodyData.event;
    const pixDataString = bodyData.pix;

    console.log('Evento recebido:', eventType);

    if (eventType !== 'pix.cash-in.received') {
      return NextResponse.json({ success: true, message: 'Evento ignorado' }, { status: 200 });
    }

    if (!pixDataString) {
      return NextResponse.json({ error: '"pix" field not found' }, { status: 400 });
    }

    const pixParams = new URLSearchParams(pixDataString);
    const pixInfo: { [key: string]: any } = {};
    pixParams.forEach((value, key) => {
      pixInfo[key] = value;
    });

    const description = pixInfo.description;
    if (!description || !description.includes('| Tribo Tools - Plans:[')) {
      return NextResponse.json({ error: 'Descrição inválida' }, { status: 400 });
    }

    const email = description.split(' | ')[0];
    const name = pixInfo.name;
    const document = pixInfo.document;
    const phone = pixInfo.phone;
    const planIdsPart = description.substring(description.indexOf('[') + 1, description.indexOf(']'));
    const selectedPlanIds = planIdsPart.split(',');

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: `Usuário com email ${email} não encontrado.` }, { status: 404 });
    }

    const userDoc = querySnapshot.docs[0];
    const userDocRef = userDoc.ref;
    const userData = userDoc.data();

    const allPlans = initialProducts.flatMap(p =>
      p.plans.map(plan => ({ ...plan, productId: p.id, productName: p.name }))
    );

    const newSubscriptions = { ...(userData.subscriptions || {}) };
    let changesMade = false;

    for (const planId of selectedPlanIds) {
      const plan = allPlans.find(p => p.id === planId);
      if (plan) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.days);

        newSubscriptions[plan.productId] = {
          status: 'active',
          plan: plan.id,
          startedAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(expiresAt),
        };
        changesMade = true;
        console.log(`Plano '${plan.name}' ativado até ${expiresAt.toISOString()}`);
      }
    }

    if (changesMade) {
      const batch = writeBatch(db);
      batch.update(userDocRef, {
        subscriptions: newSubscriptions,
        name: name || userData.name || '',
        document: document || userData.document || '',
        phone: phone || userData.phone || '',
      });
      await batch.commit();
      console.log(`Assinatura de ${email} atualizada com sucesso.`);
    }

    // 🔁 Enviar para n8n
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      console.log('Encaminhando para o n8n...');
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment_success',
          email,
          name,
          phone,
          document,
          planIds: selectedPlanIds,
          amount: pixInfo.value ? pixInfo.value / 100 : 0,
          paymentDate: new Date().toISOString(),
        }),
      }).catch(n8nError => {
        console.error('Erro ao encaminhar para n8n:', n8nError);
      });
    }

    return NextResponse.json({ success: true, message: 'Webhook processado com sucesso.' }, { status: 200 });
  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK PROCESSING ERROR !!!---');
    console.error('Erro:', error.message);
    console.error('Stack Trace:', error.stack);
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 });
  }
}
