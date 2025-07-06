
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import type { UserSubscription } from '@/lib/types';
import { allPlans } from '@/lib/plans';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Log for debugging purposes
    console.log('Webhook received:', body);

    // Basic validation
    if (body.status !== 'approved' || !body.email || !body.name) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { email, name: receivedProductName } = body;

    let planIds: string[] = [];
    // New format: "Tribo Tools - Plans:[plan_id_1,plan_id_2]"
    const plansMatch = receivedProductName.match(/Plans:\[(.*?)\]/);

    if (plansMatch && plansMatch[1]) {
        planIds = plansMatch[1].split(',').filter(id => id.trim() !== '');
    } else {
        // Fallback for old payment format for backward compatibility
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

    // Find user in Firestore by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`User not found with email: ${email}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = querySnapshot.docs[0];
    const userRef = doc(db, 'users', userDoc.id);

    // Prepare updates for all purchased plans
    const updates: { [key: string]: any } = {};

    for (const planId of planIds) {
        const matchedPlan = allPlans.find(p => p.id === planId);

        if (!matchedPlan) {
            console.warn(`Webhook: Plan with ID '${planId}' not found. Skipping.`);
            continue;
        }

        const { productId, id: matchedPlanId, days } = matchedPlan;
        
        // Calculate new expiration date
        const now = new Date();
        const expiresAt = new Date(new Date().setDate(now.getDate() + days));

        const newSubscriptionData: UserSubscription = {
            status: 'active',
            plan: matchedPlanId,
            startedAt: Timestamp.fromDate(new Date()),
            expiresAt: Timestamp.fromDate(expiresAt),
        };
        
        updates[`subscriptions.${productId}`] = newSubscriptionData;
    }

    // Atomically update all subscriptions in one go
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
