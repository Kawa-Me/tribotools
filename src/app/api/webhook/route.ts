
'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import type { UserSubscription, Product, Plan } from '@/lib/types';

// Helper to get plans directly from Firestore on the server
async function getPlansFromFirestore() {
  if (!db) return [];
  const productsSnapshot = await getDocs(collection(db, 'products'));
  const products = productsSnapshot.docs.map(doc => doc.data() as Product);
  return products.flatMap(p => 
    p.plans.map(plan => ({...plan, productId: p.id, productName: p.name}))
  );
}

export async function POST(request: Request) {
  // Log every incoming request to see if the webhook is even reaching us.
  console.log('--- WEBHOOK RECEIVED ---');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl || siteUrl.includes('localhost')) {
     console.warn(`
      --- AVISO DE DESENVOLVIMENTO ---
      A URL do webhook parece ser de um ambiente local.
      A liberação automática de acesso NÃO funcionará.
      Em produção, com uma URL pública, o webhook funcionará normalmente.
      --- FIM DO AVISO ---
    `);
  }

  try {
    const formData = await request.formData();
    const event = formData.get('event') as string;
    const pixJson = formData.get('pix') as string;

    // Log the received form data parts for debugging
    console.log('Webhook Event:', event);
    console.log('Webhook Pix JSON String:', pixJson);

    if (!pixJson) {
      console.error('Webhook payload is missing the "pix" field.');
      try {
        const fullBody = Object.fromEntries(formData.entries());
        console.error('Full form data received:', JSON.stringify(fullBody, null, 2));
      } catch (e) {
          console.error('Could not serialize full form data.');
      }
      return NextResponse.json({ error: 'Invalid webhook payload: missing pix data' }, { status: 400 });
    }
    
    const pixData = JSON.parse(pixJson);
    
    // Log the entire reconstructed payload for debugging
    console.log('Webhook Reconstructed Body:', JSON.stringify({ event, pix: pixData }, null, 2));

    if (event !== 'pix_approved' || !pixData || !pixData.customer || !pixData.customer.email) {
      console.log('Webhook ignored: Not a "pix_approved" event or missing essential data.');
      return NextResponse.json({ message: 'Webhook received but not processed' }, { status: 200 });
    }

    console.log('Processing "pix_approved" event.');

    const { email, name, document, phone } = pixData.customer;
    const paymentDescription = pixData.description;
    console.log(`Customer Email: ${email}`);
    console.log(`Customer Name: ${name || 'N/A'}`);
    console.log(`Customer Document: ${document || 'N/A'}`);
    console.log(`Customer Phone: ${phone || 'N/A'}`);
    console.log(`Payment Description: ${paymentDescription}`);

    const allPlans = await getPlansFromFirestore();
    if (allPlans.length === 0) {
        console.error('SERVER CONFIG ERROR: No plans configured in Firestore.');
        return NextResponse.json({ error: 'Server configuration error: No plans found' }, { status: 500 });
    }
    console.log('Successfully fetched all plans from Firestore.');

    let planIds: string[] = [];
    const plansMatch = paymentDescription.match(/Plans:\[(.*?)\]/);

    if (plansMatch && plansMatch[1]) {
        planIds = plansMatch[1].split(',').filter(id => id.trim() !== '');
    }
    
    if (planIds.length === 0) {
        console.error(`No parsable plan IDs found in payment description: "${paymentDescription}"`);
        return NextResponse.json({ error: 'Plan not found in webhook payload' }, { status: 400 });
    }
    console.log(`Parsed Plan IDs: [${planIds.join(', ')}]`);

    if (!db) {
      console.error('DATABASE ERROR: Firestore is not initialized.');
      return NextResponse.json({ error: 'Internal server error: DB not configured' }, { status: 500 });
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`USER NOT FOUND with email: ${email}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log(`Found user document for email: ${email}`);

    const userDoc = querySnapshot.docs[0];
    const userRef = doc(db, 'users', userDoc.id);
    const userData = userDoc.data();
    const existingSubscriptions = userData.subscriptions || {};
    console.log('Existing user subscriptions:', JSON.stringify(existingSubscriptions, null, 2));

    const updates: { [key: string]: any } = {
        // Save/update customer personal data on purchase
        ...(name && { name }),
        ...(document && { document }),
        ...(phone && { phone }),
    };

    for (const planId of planIds) {
        const matchedPlan = allPlans.find(p => p.id === planId);

        if (!matchedPlan) {
            console.warn(`Webhook Warning: Plan with ID '${planId}' not found in Firestore plans. Skipping.`);
            continue;
        }
        console.log(`Processing matched plan: ${matchedPlan.productName} - ${matchedPlan.name}`);

        const { productId, id: matchedPlanId, days } = matchedPlan;
        
        const now = new Date();
        const currentSub = existingSubscriptions[productId];
        let startDate = now;

        if (currentSub && currentSub.status === 'active' && currentSub.expiresAt) {
            const currentExpiry = currentSub.expiresAt.toDate();
            if (currentExpiry > now) {
                startDate = currentExpiry;
                console.log(`Active subscription found. Extending from current expiry: ${currentExpiry.toISOString()}`);
            } else {
                 console.log(`Expired subscription found. Starting new subscription from today.`);
            }
        } else {
             console.log(`No active subscription found. Starting new subscription from today.`);
        }
        
        const expiresAt = new Date(new Date(startDate).setDate(startDate.getDate() + days));
        console.log(`New expiry date calculated: ${expiresAt.toISOString()}`);

        const newSubscriptionData: UserSubscription = {
            status: 'active',
            plan: matchedPlanId,
            startedAt: Timestamp.fromDate(new Date()),
            expiresAt: Timestamp.fromDate(expiresAt),
        };
        
        updates[`subscriptions.${productId}`] = newSubscriptionData;
    }

    if (Object.keys(updates).length > 1 || (Object.keys(updates).length === 1 && !updates.name && !updates.document && !updates.phone)) {
        console.log('Applying updates to Firestore:', JSON.stringify(updates, null, 2));
        await updateDoc(userRef, updates);
        const grantedProducts = Object.keys(updates).filter(k => k.startsWith('subscriptions.')).map(k => k.split('.')[1]).join(', ');
        console.log(`SUCCESS: Successfully updated subscriptions for ${email}. Granted access to products: ${grantedProducts}`);
        
        // --- NEW: Forward data to n8n webhook ---
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (n8nWebhookUrl) {
          try {
            console.log(`Forwarding data to n8n webhook: ${n8nWebhookUrl}`);
            const purchasedPlans = allPlans.filter(p => planIds.includes(p.id));
            const n8nPayload = {
              customer: pixData.customer,
              payment: {
                description: pixData.description,
                value: pixData.value ? (pixData.value / 100).toFixed(2) : '0.00',
              },
              purchased_plans: purchasedPlans.map(p => ({ 
                  id: p.id, 
                  name: p.name, 
                  productName: p.productName 
              })),
              site_url: siteUrl
            };
    
            const n8nResponse = await fetch(n8nWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(n8nPayload),
            });
    
            if (!n8nResponse.ok) {
              console.error(`Error sending data to n8n webhook. Status: ${n8nResponse.status}`, await n8nResponse.text());
            } else {
              console.log('Successfully forwarded data to n8n webhook.');
            }
          } catch (e) {
            console.error('Failed to call n8n webhook:', e);
          }
        } else {
            console.log('N8N_WEBHOOK_URL not set. Skipping notification.');
        }

    } else {
         console.log(`No valid plans found to update for ${email}. No database changes made.`);
    }
    
    return NextResponse.json({ success: true, message: 'Webhook processed successfully.' });

  } catch (error) {
    console.error('---!!! FATAL WEBHOOK ERROR !!!---');
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error Details:', errorMessage);
    if (error instanceof Error && error.stack) {
        console.error('Stack Trace:', error.stack);
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

    