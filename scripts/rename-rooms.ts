// 회의실 이름을 다우오피스 형식으로 일괄 변경하는 마이그레이션 스크립트
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

const RENAME_MAP: Record<string, string> = {
  '열정룸':   '[818호] 열정룸',
  '행복룸':   '[818호] 행복룸',
  '게임체인저': '[807호] 게임체인저',
  '의문당':   '[710호] 疑問堂(의문당)',
}

async function main() {
  const snap = await db.collection('rooms').get()

  // 이름별로 문서 그룹핑
  const grouped = new Map<string, { id: string; order: number }[]>()
  for (const doc of snap.docs) {
    const name = doc.data().name as string
    const order = typeof doc.data().order === 'number' ? doc.data().order as number : 9999
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name)!.push({ id: doc.id, order })
  }

  // 이름 변경: RENAME_MAP에 있는 이름만 업데이트
  for (const doc of snap.docs) {
    const name = doc.data().name as string
    const newName = RENAME_MAP[name]
    if (newName) {
      await db.collection('rooms').doc(doc.id).update({ name: newName })
      console.log(`이름 변경: "${name}" → "${newName}"`)
    }
  }

  // 중복 제거: order가 낮은 것(원본) 유지, 나머지 삭제
  for (const [name, docs] of grouped) {
    if (docs.length <= 1) continue
    const sorted = docs.sort((a, b) => a.order - b.order)
    for (const dup of sorted.slice(1)) {
      await db.collection('rooms').doc(dup.id).delete()
      console.log(`중복 삭제: ${name} (id: ${dup.id})`)
    }
  }

  console.log('\n완료')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
