// src/pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { initialProducts } from '@/lib/plans';
import type { IncomingMessage } from 'http';
import { Buffer } from 'buffer';

export const config = {
  api: {
    bodyParser: false, // ESSENCIAL: evita o erro de JSON parse
  },
};

// Helper para ler o corpo bruto da requisição
function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', err => reject(err));
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Método não permitido');

  try {
    const rawBody = await getRawBody(req);
    const contentType = req.headers['content-type'] || '';
    
    console.log('--- WEBHOOK RECEIVED ---');
    console.log(`Raw Body Received:\n${rawBody.toString('utf-8')}`);

    let formData: URLSearchParams;
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('text/plain')) {
      formData = new URLSearchParams(rawBody.toString('utf-8'));
    } else {
      console.warn(`Unsupported Content-Type: ${contentType}`);
      return res.status(415).json({ error: `Unsupported content-type: ${contentType}` });
    }

    const eventType = formData.get('event');
    const pixDataString = formData.get('pix');
    
    console.log('Evento recebido:', eventType);

    if (eventType !== 'pix.cash-in.received') {
      return res.status(200).json({ success: true, message: 'Evento ignorado' });
    }

    if (!pixDataString) {
      return res.status(400).json({ error: '"pix" field not found' });
    }

    const pixParams = new URLSearchParams(pixDataString);
    const pixInfo: Record<string, any> = {};
    pixParams.forEach((value, key) => {
      pixInfo[key] = value;
    });

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

    if (!db) {
        console.error('Erro fatal: Conexão com o Firestore não está disponível.');
        return res.status(500).json({ error: 'Erro de configuração do servidor (DB)' });
    }
    
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
      console.log(`Assinatura de ${email} atualizada com sucesso.`);
    }

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
      }).catch(err => console.error('Erro ao enviar para n8n:', err));
    }

    return res.status(200).json({ success: true, message: 'Webhook processado com sucesso.' });
  } catch (err: any) {
    console.error('---!!! FATAL WEBHOOK PROCESSING ERROR !!!---');
    console.error('Erro:', err.message);
    console.error('Stack Trace:', err.stack);
    return res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
  }
}
