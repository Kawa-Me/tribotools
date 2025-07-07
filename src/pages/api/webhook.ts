// src/pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import getRawBody from 'raw-body';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, writeBatch, Timestamp } from 'firebase/firestore';
import { initialProducts } from '@/lib/plans';

export const config = {
  api: {
    bodyParser: false, // desativa o bodyParser para podermos ler o body cru
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    console.log('--- WEBHOOK RECEIVED ---');

    const rawBody = await getRawBody(req);
    const contentType = req.headers['content-type'] || '';

    let bodyData: any = null;

    if (contentType.includes('application/json')) {
      bodyData = JSON.parse(rawBody.toString());
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('text/plain')
    ) {
      const formData = new URLSearchParams(rawBody.toString());
      bodyData = {};
      for (const [key, value] of formData.entries()) {
        bodyData[key] = value;
      }
    } else {
      return res.status(400).json({ error: 'Unsupported content type' });
    }

    const eventType = bodyData.event;
    const pixDataString = bodyData.pix;

    if (eventType !== 'pix.cash-in.received') {
      return res.status(200).json({ success: true, message: 'Evento ignorado' });
    }

    if (!pixDataString) {
      return res.status(400).json({ error: '"pix" field not found' });
    }

    const pixParams = new URLSearchParams(pixDataString);
    const pixInfo: Record<string, string> = {};
    for (const [key, value] of pixParams.entries()) {
      pixInfo[key] = value;
    }

    const description = pixInfo.description;
    if (!description || !description.includes('| Tribo Tools - Plans:[')) {
      return res.status(400).json({ error: 'Descrição inválida' });
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
      return res.status(404).json({ error: `Usuário com email ${email} não encontrado.` });
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
    }

    // 🔁 Enviar para o n8n
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
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
          amount: pixInfo.value ? Number(pixInfo.value) / 100 : 0,
          paymentDate: new Date().toISOString(),
        }),
      }).catch(err => console.error('Erro ao enviar para o n8n:', err));
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK ERROR !!!---');
    console.error(error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
}
