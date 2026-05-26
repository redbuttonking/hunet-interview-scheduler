// [818호] 행복룸을 Firestore에 추가하는 일회성 스크립트
import * as admin from 'firebase-admin'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
})

const db = admin.firestore()

async function main() {
  const snap = await db.collection('rooms').get()

  // 이미 존재하는지 확인
  const exists = snap.docs.some((d) => d.data().name === '[818호] 행복룸')
  if (exists) {
    console.log('이미 존재합니다: [818호] 행복룸')
    process.exit(0)
  }

  // 현재 최대 order 값 계산
  const maxOrder = snap.docs.reduce((max, d) => {
    const o = d.data().order
    return typeof o === 'number' ? Math.max(max, o) : max
  }, -1)

  await db.collection('rooms').add({
    name: '[818호] 행복룸',
    order: maxOrder + 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  console.log(`추가 완료: [818호] 행복룸 (order: ${maxOrder + 1})`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
