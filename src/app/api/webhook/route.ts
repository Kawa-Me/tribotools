
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import type { UserSubscription, Product } from '@/lib/types';

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
  try {
    const body = await request.json();
    
    // Log for debugging purposes
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const event = body.event;
    const pixData = body.pix;

    if (event !== 'pix_approved' || !pixData || !pixData.customer || !pixData.customer.email) {
      console.log('Webhook ignored: not a "pix_approved" event or missing essential data.');
      return NextResponse.json({ message: 'Webhook received but not processed' }, { status: 200 });
    }

    const { email } = pixData.customer;
    // The name contains the user's real name and our plan metadata
    const receivedProductName = pixData.customer.name; 

    const allPlans = await getPlansFromFirestore();
    if (allPlans.length === 0) {
        console.error('No plans configured in Firestore.');
        return NextResponse.json({ error: 'Server configuration error: No plans found' }, { status: 500 });
    }

    let planIds: string[] = [];
    // Regex to extract plan IDs from a string like "John Doe | Tribo Tools - Plans:[plan_id_1,plan_id_2]"
    const plansMatch = receivedProductName.match(/Plans:\[(.*?)\]/);

    if (plansMatch && plansMatch[1]) {
        planIds = plansMatch[1].split(',').filter(id => id.trim() !== '');
    } else {
        // Fallback for old format just in case
        const matchedPlan = allPlans.find(p => receivedProductName.includes(p.productName) && receivedProductName.includes(p.name));
        if (matchedPlan) {
            planIds.push(matchedPlan.id);
        }
    }
    
    if (planIds.length === 0) {
        console.error(`No parsable plans found in product name: ${receivedProductName}`);
        return NextResponse.json({ error: 'Plan not found in webhook payload' }, { status: 404 });
    }

    if (!db) {
      console.error('Firestore is not initialized.');
      return NextResponse.json({ error: 'Internal server error: DB not configured' }, { status: 500 });
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`User not found with email: ${email}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = querySnapshot.docs[0];
    const userRef = doc(db, 'users', userDoc.id);
    const userData = userDoc.data();
    const existingSubscriptions = userData.subscriptions || {};

    const updates: { [key: string]: any } = {};

    for (const planId of planIds) {
        const matchedPlan = allPlans.find(p => p.id === planId);

        if (!matchedPlan) {
            console.warn(`Webhook: Plan with ID '${planId}' not found. Skipping.`);
            continue;
        }

        const { productId, id: matchedPlanId, days } = matchedPlan;
        
        const now = new Date();
        const currentSub = existingSubscriptions[productId];
        let startDate = now;

        // If user has an active sub, extend it. Otherwise, start from now.
        if (currentSub && currentSub.status === 'active' && currentSub.expiresAt) {
            const currentExpiry = currentSub.expiresAt.toDate();
            if (currentExpiry > now) {
                startDate = currentExpiry;
            }
        }
        
        const expiresAt = new Date(new Date(startDate).setDate(startDate.getDate() + days));

        const newSubscriptionData: UserSubscription = {
            status: 'active',
            plan: matchedPlanId,
            startedAt: Timestamp.fromDate(new Date()),
            expiresAt: Timestamp.fromDate(expiresAt),
        };
        
        updates[`subscriptions.${productId}`] = newSubscriptionData;
    }

    if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        console.log(`Successfully updated subscriptions for ${email} with plans: ${planIds.join(', ')}.`);
    } else {
         console.log(`No valid plans to update for ${email}.`);
    }
    
    return NextResponse.json({ success: true, message: 'User updated successfully' });

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
