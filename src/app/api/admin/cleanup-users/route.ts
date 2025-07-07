
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Helper to initialize Firebase Admin SDK only once
const initializeAdminApp = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string.');
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${e.message}`);
  }
};

export async function POST(req: Request) {
    try {
        initializeAdminApp();
        const auth = admin.auth();

        const authorization = req.headers.get('Authorization');
        if (!authorization?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
        }
        const idToken = authorization.split('Bearer ')[1];
        
        const userDoc = await auth.verifyIdToken(idToken, true);

        // This check is critical. We need to look up the user in our DB to confirm their role.
        const firestore = admin.firestore();
        const userDbRecord = await firestore.collection('users').doc(userDoc.uid).get();
        
        if (!userDbRecord.exists || userDbRecord.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
        }

        // --- Cleanup Logic ---
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        let uidsToDelete: string[] = [];
        let pageToken: string | undefined;

        console.log("Starting cleanup of anonymous users created before:", oneHourAgo);

        do {
            const listUsersResult = await auth.listUsers(1000, pageToken);
            const anonymousUsers = listUsersResult.users.filter(user => 
                user.providerData.length === 0 && user.metadata.creationTime < oneHourAgo
            );
            
            uidsToDelete.push(...anonymousUsers.map(user => user.uid));
            pageToken = listUsersResult.pageToken;
        } while (pageToken);

        if (uidsToDelete.length === 0) {
            return NextResponse.json({ success: true, deletedCount: 0, message: 'No old anonymous users found.' });
        }
        
        console.log(`Found ${uidsToDelete.length} anonymous users to delete.`);
        const deleteResult = await auth.deleteUsers(uidsToDelete);
        
        if (deleteResult.failureCount > 0) {
             console.error("Failed to delete some users:", deleteResult.errors);
        }

        console.log(`Successfully deleted ${deleteResult.successCount} users.`);
        return NextResponse.json({ success: true, deletedCount: deleteResult.successCount, failureCount: deleteResult.failureCount });

    } catch (error: any) {
        console.error('---!!! FATAL ERROR during anonymous user cleanup !!!---', error);
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return NextResponse.json({ error: 'Unauthorized: Invalid token.' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
