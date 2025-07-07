import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { headers } from 'next/headers';

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

export async function POST() {
    try {
        initializeAdminApp();

        const headersList = headers();
        const authorization = headersList.get('authorization');

        if (!authorization || !authorization.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
        }
        
        const token = authorization.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        const userRecord = await admin.auth().getUser(decodedToken.uid);
        const customClaims = userRecord.customClaims || {};

        if (customClaims.role !== 'admin') {
             return NextResponse.json({ error: 'Forbidden: User is not an admin' }, { status: 403 });
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        let allUsers: admin.auth.UserRecord[] = [];
        let pageToken: string | undefined;

        // List all users from Firebase Auth
        do {
            const listUsersResult = await admin.auth().listUsers(1000, pageToken);
            allUsers = allUsers.concat(listUsersResult.users);
            pageToken = listUsersResult.pageToken;
        } while (pageToken);

        // Filter for anonymous users created more than an hour ago
        const usersToDelete = allUsers.filter(user => {
            const creationTime = new Date(user.metadata.creationTime);
            const isAnonymous = user.providerData.length === 0;
            return isAnonymous && creationTime < oneHourAgo;
        });

        if (usersToDelete.length === 0) {
            return NextResponse.json({ deletedCount: 0, message: 'No old anonymous users to delete.' }, { status: 200 });
        }

        const uidsToDelete = usersToDelete.map(user => user.uid);
        
        // Firebase Admin SDK's deleteUsers can take a maximum of 1000 UIDs at a time.
        // We'll chunk the array to be safe.
        const chunkSize = 1000;
        let totalDeletedCount = 0;

        for (let i = 0; i < uidsToDelete.length; i += chunkSize) {
            const chunk = uidsToDelete.slice(i, i + chunkSize);
            const deleteResult = await admin.auth().deleteUsers(chunk);
            totalDeletedCount += deleteResult.successCount;
            if (deleteResult.failureCount > 0) {
                 console.error('Failed to delete some users:', deleteResult.errors);
            }
        }
        
        return NextResponse.json({ deletedCount: totalDeletedCount }, { status: 200 });

    } catch (error: any) {
        console.error('---!!! Cleanup Users Error !!!---', error);
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired, please log in again.' }, { status: 401 });
        }
         if (error.code === 'auth/argument-error') {
            return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
        }
        return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
}
