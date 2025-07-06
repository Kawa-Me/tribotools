
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

    // Find the plan configuration that matches the product name from the webhook
    const matchedPlan = allPlans.find(p => receivedProductName.includes(p.productName) && receivedProductName.includes(p.name));
    
    if (!matchedPlan) {
        console.error(`No plan found for product name: ${receivedProductName}`);
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const { productId, id: planId, days } = matchedPlan;
    
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

    // Calculate new expiration date
    const now = new Date();
    const expiresAt = new Date(now.setDate(now.getDate() + days));

    const newSubscriptionData: UserSubscription = {
      status: 'active',
      plan: planId,
      startedAt: Timestamp.fromDate(new Date()),
      expiresAt: Timestamp.fromDate(expiresAt),
    };

    // Update user document using dot notation for nested object
    await updateDoc(userRef, {
      [`subscriptions.${productId}`]: newSubscriptionData
    });
    
    console.log(`Successfully updated subscription for ${email} to product ${productId}.`);
    
    return NextResponse.json({ success: true, message: 'User updated successfully' });

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
