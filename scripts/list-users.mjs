// Firebase Auth 사용자 목록 확인 및 테스트 비밀번호 설정 스크립트
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map((v, i) => i === 0 ? v.trim() : l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')))
    .filter(([k]) => k)
);

const { initializeApp, cert, getApps } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = getAuth();
const result = await auth.listUsers(20);

console.log('=== 등록된 계정 목록 ===');
for (const user of result.users) {
  console.log(`이메일: ${user.email} | 역할: ${JSON.stringify(user.customClaims)}`);
}

// 첫 번째 admin 계정에 테스트 비밀번호 설정
const adminUser = result.users.find(u => u.customClaims?.role === 'admin');
const testUser = adminUser || result.users[0];

if (testUser) {
  const TEST_PW = 'Test1234!';
  await auth.updateUser(testUser.uid, { password: TEST_PW });
  console.log(`\n테스트 비밀번호 설정 완료`);
  console.log(`이메일: ${testUser.email}`);
  console.log(`비밀번호: ${TEST_PW}`);
}
