import type { NextApiRequest, NextApiResponse } from 'next';
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
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY.');
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${e.message}`);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const app = initializeAdminApp();
    const auth = admin.auth(app);
    const db = admin.firestore(app);

    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
    const token = authorization.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const adminUid = decodedToken.uid;

    const adminUserDoc = await db.collection('users').doc(adminUid).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: User is not an admin.' });
    }

    // Anonymous users are identified by having `email: null` in our Firestore setup.
    // They are also considered for deletion only if created more than 1 hour ago.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneHourAgoTimestamp = admin.firestore.Timestamp.fromDate(oneHourAgo);

    const snapshot = await db.collection('users')
        .where('email', '==', null)
        .where('createdAt', '<=', oneHourAgoTimestamp)
        .get();

    if (snapshot.empty) {
      return res.status(200).json({ message: 'No expired anonymous users to delete.', deletedCount: 0 });
    }

    const uidsToDelete: string[] = snapshot.docs.map(doc => doc.id);

    // Delete from Firestore
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Delete from Firebase Auth
    // Auth deletions must be done one by one or in batches of up to 1000
    const deleteAuthUsersResult = await auth.deleteUsers(uidsToDelete);
    
    const deletedCount = deleteAuthUsersResult.successCount;
    const failedCount = deleteAuthUsersResult.failureCount;

    console.log(`Successfully deleted ${deletedCount} anonymous users.`);
    if (failedCount > 0) {
        console.error(`Failed to delete ${failedCount} anonymous users from Auth.`, deleteAuthUsersResult.errors);
    }
    
    res.status(200).json({ message: 'Cleanup successful.', deletedCount });

  } catch (error: any) {
    console.error('---!!! ERROR in cleanup-users API !!!---', error);
    let errorMessage = 'Internal Server Error';
    if (error.code === 'auth/id-token-expired') {
        errorMessage = 'Authentication token has expired. Please log in again.';
        return res.status(401).json({ error: errorMessage });
    }
    if (error.code === 'auth/argument-error') {
        errorMessage = 'Invalid token provided.';
        return res.status(401).json({ error: errorMessage });
    }
    res.status(500).json({ error: errorMessage, details: error.message });
  }
}
