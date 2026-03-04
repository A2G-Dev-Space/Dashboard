/**
 * Firebase Auth Routes
 *
 * 모바일 앱(에이아이)용 Firebase 인증 엔드포인트
 * - Firebase ID Token → Dashboard JWT 교환
 * - 기존 SSO 인증과 완전히 분리 (기존 서비스 영향 없음)
 */

import { Router } from 'express';
import admin from 'firebase-admin';
import { prisma } from '../index.js';
import { signToken } from '../middleware/auth.js';
import { trackActiveUser } from '../services/redis.service.js';
import { redis } from '../index.js';

// Initialize Firebase Admin (singleton)
if (!admin.apps.length) {
  const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (serviceAccountJson) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      });
    } catch (e) {
      console.error('Failed to initialize Firebase Admin with service account:', e);
    }
  } else if (process.env['FIREBASE_PROJECT_ID']) {
    admin.initializeApp({
      projectId: process.env['FIREBASE_PROJECT_ID'],
    });
  }
  // If neither is set, Firebase endpoints will return 503
}

export const firebaseAuthRoutes = Router();

/**
 * POST /auth/firebase-exchange
 * Exchange Firebase ID Token for Dashboard JWT
 *
 * Request body: { idToken: string }
 * Response: { success, user, sessionToken }
 */
firebaseAuthRoutes.post('/firebase-exchange', async (req, res) => {
  try {
    if (!admin.apps.length) {
      res.status(503).json({ error: 'Firebase authentication is not configured on the server' });
      return;
    }

    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      res.status(400).json({ error: 'Firebase ID token is required' });
      return;
    }

    // Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Use Firebase UID as loginid (prefixed to avoid collision with SSO loginids)
    const loginid = `firebase:${uid}`;
    const username = name || email || uid;

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { loginid },
      update: {
        username,
        lastActive: new Date(),
      },
      create: {
        loginid,
        username,
        deptname: 'mobile',
      },
    });

    // Track active user in Redis
    await trackActiveUser(redis, loginid);

    // Issue Dashboard JWT
    const sessionToken = signToken({
      loginid,
      deptname: 'mobile',
      username,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        loginid: user.loginid,
        username: user.username,
        email: email || null,
        photoUrl: picture || null,
      },
      sessionToken,
    });
  } catch (error: any) {
    console.error('Firebase exchange error:', error);

    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({ error: 'Firebase token expired' });
    } else if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked') {
      res.status(401).json({ error: 'Invalid Firebase token' });
    } else {
      res.status(500).json({ error: 'Failed to exchange Firebase token' });
    }
  }
});
