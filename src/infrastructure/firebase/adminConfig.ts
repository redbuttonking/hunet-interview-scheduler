// 서버 전용 — 클라이언트 코드에서 import 금지
import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const ADMIN_APP_NAME = 'hunet-admin'

function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME)
  if (existing) return existing
  return initializeApp(
    {
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '',
      }),
    },
    ADMIN_APP_NAME,
  )
}

export const adminAuth = () => getAuth(getAdminApp())
export const adminDb = () => getFirestore(getAdminApp())
