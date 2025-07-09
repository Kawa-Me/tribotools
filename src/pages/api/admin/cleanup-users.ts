import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { initializeAdminApp } from '@/lib/firebase-admin';

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

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Fetch all anonymous users first, then filter by date in code to avoid needing a composite index.
    const anonymousUsersSnapshot = await db.collection('users')
        .where('email', '==', null)
        .get();

    if (anonymousUsersSnapshot.empty) {
      return res.status(200).json({ message: 'No anonymous users found to process.', deletedCount: 0 });
    }

    const uidsToDelete: string[] = [];
    const docsToDelete: admin.firestore.QueryDocumentSnapshot[] = [];

    anonymousUsersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;

        // Only consider users with a creation date that is older than one hour
        if (createdAt && createdAt.toDate() < oneHourAgo) {
            uidsToDelete.push(doc.id);
            docsToDelete.push(doc);
        }
    });

    if (uidsToDelete.length === 0) {
      return res.status(200).json({ message: 'No expired anonymous users to delete.', deletedCount: 0 });
    }
    
    // Delete from Firestore
    const batch = db.batch();
    docsToDelete.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Delete from Firebase Auth
    // Auth deletions can be done in batches of up to 1000
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
