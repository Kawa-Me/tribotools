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

    // Delete pending payments older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const pendingPaymentsSnapshot = await db.collection('payments')
        .where('status', '==', 'pending')
        .get();

    if (pendingPaymentsSnapshot.empty) {
      return res.status(200).json({ message: 'No pending payments found to process.', deletedCount: 0 });
    }

    const docsToDelete: admin.firestore.QueryDocumentSnapshot[] = [];

    pendingPaymentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;

        // Only consider payments created more than 7 days ago
        if (createdAt && createdAt.toDate() < sevenDaysAgo) {
            docsToDelete.push(doc);
        }
    });

    if (docsToDelete.length === 0) {
      return res.status(200).json({ message: 'No expired pending payments to delete.', deletedCount: 0 });
    }
    
    const batch = db.batch();
    docsToDelete.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    const deletedCount = docsToDelete.length;

    console.log(`Successfully deleted ${deletedCount} pending payments.`);
    
    res.status(200).json({ message: 'Cleanup successful.', deletedCount });

  } catch (error: any) {
    console.error('---!!! ERROR in cleanup-pending-payments API !!!---', error);
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
