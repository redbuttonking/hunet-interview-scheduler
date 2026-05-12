import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

// .env.local 파싱
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=')
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1')
      return [key, val]
    }),
)

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})

const db = getFirestore()

// Firebase 콘솔 Authentication에서 계정 생성 후 아래 값을 채워서 실행
const UID = '여기에_Firebase_UID_입력'
const EMAIL = '여기에_이메일_입력'
const NAME = '여기에_이름_입력'

await db.collection('users').doc(UID).set({
  email: EMAIL,
  name: NAME,
  role: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
})

console.log('관리자 계정 문서 생성 완료')
