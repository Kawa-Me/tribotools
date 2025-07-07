'use server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { initialProducts } from '@/lib/plans';

// This is the new, robust implementation.
export async function POST(request: Request) {
  console.log('--- WEBHOOK RECEIVED ---');
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSource = request.headers.get('user-agent') || 'Unknown';
  console.log(`Webhook received from: ${webhookSource}`);

  try {
    // Step 1: Read the entire request body as plain text.
    // This avoids any automatic JSON parsing by the framework.
    const bodyText = await request.text();
    console.log('Raw Body Text:', bodyText);

    if (!bodyText) {
      throw new Error('Received an empty webhook body.');
    }

    // Step 2: Manually parse the form-data from the text.
    const formData = new URLSearchParams(bodyText);
    const eventType = formData.get('event');
    const pixDataString = formData.get('pix');

    console.log('Parsed Event Type:', eventType);

    if (eventType !== 'pix.cash-in.received') {
      console.log(`Ignoring event type: ${eventType}`);
      return NextResponse.json({ success: true, message: 'Event ignored.' }, { status: 200 });
    }

    if (!pixDataString) {
      throw new Error('"pix" field not found for a cash-in event.');
    }
    
    console.log('Raw PIX Data String:', pixDataString);

    // Step 3: The 'pix' field is also URL-encoded. Parse it as well.
    const pixParams = new URLSearchParams(pixDataString);
    const pixInfo: { [key: string]: any } = {};
    pixParams.forEach((value, key) => {
      pixInfo[key] = value;
    });

    console.log('Parsed PIX Info:', pixInfo);
    
    // Step 4: Extract user email and plan IDs from the description.
    const description = pixInfo.description;
    if (!description || !description.includes('| Tribo Tools - Plans:[')) {
      throw new Error('Description field is missing or invalid for processing.');
    }

    const name = pixInfo.name;
    const document = pixInfo.document;
    const phone = pixInfo.phone;
    const email = description.split(' | ')[0];
    const planIdsPart = description.substring(description.indexOf('[') + 1, description.indexOf(']'));
    const selectedPlanIds = planIdsPart.split(',');

    console.log(`Processing for Email: ${email}, Plan IDs: ${selectedPlanIds.join(', ')}`);

    if (!db) {
      throw new Error('Firestore database is not configured.');
    }
    
    // Step 5: Find the user by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error(`User with email ${email} not found.`);
    }

    const userDoc = querySnapshot.docs[0];
    const userDocRef = userDoc.ref;
    const userData = userDoc.data();
    console.log(`Found user: ${userDoc.id}`);

    // Step 6: Update user's subscriptions
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
        console.log(`User ${email} subscriptions updated successfully.`);
    }

    // Step 7: Forward to n8n if URL is configured
    if (n8nWebhookUrl) {
      console.log('Forwarding to n8n webhook...');
      // Fire-and-forget, no need to await
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
          amount: pixInfo.value / 100, // convert cents to currency
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
