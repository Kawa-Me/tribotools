
'use server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { initialProducts } from '@/lib/plans';

export async function POST(request: Request) {
  console.log('--- WEBHOOK RECEIVED ---');
  const webhookSource = request.headers.get('user-agent') || 'Unknown';
  const contentType = request.headers.get('content-type') || '';
  console.log(`Webhook received from: ${webhookSource} with Content-Type: ${contentType}`);

  try {
    // 1. Ler o corpo da requisição como texto puro PRIMEIRO.
    // Isso evita que o Next.js tente analisar como JSON automaticamente.
    const bodyText = await request.text();
    console.log('Raw Body Text successfully read:', bodyText);

    if (!bodyText) {
      console.error('Webhook Error: Received an empty request body.');
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    // 2. Analisar o texto como um formulário, usando a lógica que você sugeriu.
    const formData = new URLSearchParams(bodyText);
    const eventType = formData.get('event');
    const pixDataString = formData.get('pix');

    console.log('Parsed Event Type from text:', eventType);

    if (eventType !== 'pix.cash-in.received') {
      console.log(`Ignoring event type: ${eventType}`);
      return NextResponse.json({ success: true, message: 'Event ignored.' }, { status: 200 });
    }

    if (!pixDataString) {
      console.error('Webhook Error: "pix" field not found in form data.');
      return NextResponse.json({ error: '"pix" field not found' }, { status: 400 });
    }
    
    console.log('Raw PIX Data String from form data:', pixDataString);

    // 3. Analisar os dados PIX aninhados, que também são um formulário.
    const pixParams = new URLSearchParams(pixDataString);
    const pixInfo: { [key: string]: any } = {};
    pixParams.forEach((value, key) => {
      pixInfo[key] = value;
    });

    console.log('Parsed PIX Info from nested form:', pixInfo);
    
    // 4. Extrair dados e continuar com a lógica de negócio.
    const description = pixInfo.description;
    if (!description || !description.includes('| Tribo Tools - Plans:[')) {
      console.error('Webhook Error: Description field is missing or invalid.', description);
      return NextResponse.json({ error: 'Invalid description field in PIX data' }, { status: 400 });
    }

    const name = pixInfo.name;
    const document = pixInfo.document;
    const phone = pixInfo.phone;
    const email = description.split(' | ')[0];
    const planIdsPart = description.substring(description.indexOf('[') + 1, description.indexOf(']'));
    const selectedPlanIds = planIdsPart.split(',');

    console.log(`Processing for Email: ${email}, Plan IDs: ${selectedPlanIds.join(', ')}`);

    if (!db) {
      console.error('FATAL: Firestore database is not configured.');
      throw new Error('Firestore database is not configured.');
    }
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`Webhook Error: User with email ${email} not found.`);
      return NextResponse.json({ error: `User with email ${email} not found.` }, { status: 404 });
    }

    const userDoc = querySnapshot.docs[0];
    const userDocRef = userDoc.ref;
    const userData = userDoc.data();
    console.log(`Found user in Firestore: ${userDoc.id}`);

    const allPlans = initialProducts.flatMap(p => 
        p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
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
        console.log(`Granting access to product '${plan.productId}' with plan '${plan.name}' until ${expiresAt.toISOString()}`);
      } else {
        console.warn(`Plan with ID '${planId}' not found in configuration. Skipping.`);
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
        console.log(`User ${email} subscriptions updated successfully in Firestore.`);
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      console.log('Forwarding to n8n webhook...');
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          event: 'payment_success',
          email,
          name,
          phone,
          document,
          planIds: selectedPlanIds,
          amount: pixInfo.value ? (pixInfo.value / 100) : 0,
          paymentDate: new Date().toISOString(),
        }),
      }).catch(n8nError => {
          console.error("Failed to forward to n8n webhook:", n8nError);
      });
    }

    return NextResponse.json({ success: true, message: 'Webhook processed successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK PROCESSING ERROR !!!---');
    console.error(`Error Details: ${error.message}`);
    console.error(`Stack Trace: ${error.stack}`);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
