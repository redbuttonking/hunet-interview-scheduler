# 휴넷 면접 일정 조율 시스템

휴넷 채용 담당자의 면접 일정 조율 업무를 줄이기 위한 사내 웹 시스템입니다.
면접 생성, 면접관 가용 일정 수집, 회의실 추천, 후보자 일정 조율, 최종 확정, Slack 안내까지 한 흐름에서 처리합니다.

- **운영 URL**: https://hunet-interview-scheduler.vercel.app
- **GitHub**: https://github.com/redbuttonking/hunet-interview-scheduler
- **배포 방식**: GitHub Actions → Vercel CLI 프로덕션 배포

---

## 구현된 기능

| 페이지 | 기능 |
|---|---|
| 로그인 | 이메일+비밀번호 인증, 비활성 1시간 자동 로그아웃 |
| 대시보드 `/dashboard` | 예정 면접, 조율 대기, 주의 필요 항목 확인 |
| 캘린더 `/calendar` | 주간·일간 회의실 예약 확인, 드래그 예약 생성, 중복 예약 방지, 다우오피스 동기화 북마크 설정 |
| 일정 조율 `/scheduling` | 새 인터뷰 생성, Slack 발송, 가용 일정 수집, 수동 일정 등록, 추천 회의실 선택, 후보자 옵션 조율, 즉시 확정, 취소 |
| 면접관 관리 `/interviewers` | Slack 사용자 검색으로 면접관 등록, 이름 검색, 수정·삭제 |
| 포지션 관리 `/positions` | 포지션별 인터뷰 유형, 1차·2차·3차 및 복수 차수 세션, 차수별 면접관 배치, Slack 채널 검색 연결 |
| 설정 `/settings` | 관리자 전용 계정 관리, 알림 수신 담당자 관리, Slack 메시지 템플릿, 데이터 초기화 |

---

## 핵심 업무 흐름

### 1. 기본 인터뷰 조율

1. 채용 담당자가 일정 조율 화면에서 후보자명, 포지션, 인터뷰 유형, 가용 일정 범위를 입력합니다.
2. 포지션에 등록된 차수별 면접관만 선택 대상으로 표시됩니다.
3. Slack 발송 방식은 채널 또는 개인 DM 중 선택합니다.
4. 면접관은 Slack 메시지의 **일정 선택하기** 버튼을 눌러 가능한 시간을 제출합니다.
5. 전원이 제출하면 담당자에게 Slack DM으로 완료 알림이 발송됩니다.
6. 시스템이 면접관 공통 가능 시간과 예약 가능한 회의실을 추천합니다.
7. 담당자가 조율 일정 또는 즉시 확정 일정을 선택합니다.
8. 확정 시 참여 면접관에게 Slack 안내가 자동 발송됩니다.

### 2. 수동 일정 등록

외부에서 이미 조율 중이거나 확정된 인터뷰도 직접 등록할 수 있습니다.

- 후보자명, 포지션, 인터뷰 유형을 직접 입력합니다.
- 면접관 이름과 가능 날짜·시간을 직접 입력합니다.
- 원데이 인터뷰처럼 `1차+2차`가 한 세션에 묶인 경우에도 담당 차수를 나눠 관리합니다.
- 입력된 가능 시간 기준으로 예약 가능한 회의실을 추천합니다.
- 조율 중 또는 확정 상태로 등록할 수 있습니다.

---

## 다우오피스 회의실 연동

- 기존 크롬 확장 프로그램 동기화는 그대로 사용할 수 있습니다.
- 확장 프로그램 설치가 어려운 경우 캘린더의 **북마크 설정**에서 `회의실 예약 동기화` 링크를 즐겨찾기 막대로 끌어 놓습니다.
- 다우오피스에서 회의실을 예약·수정·취소하기 전에 북마크를 클릭하면, 예약 결과를 감지해 시스템의 확인 창을 엽니다.
- 확인 창에서 로그인한 관리자 또는 채용담당자가 반영을 확정합니다. 북마크에는 API 키나 예약 목적을 저장하지 않습니다.
- 페이지를 새로고침하거나 새 탭으로 이동한 경우에는 예약 전에 북마크를 다시 실행해야 합니다.

---

## Slack 연동

### 지원 기능

- Slack 사용자 검색으로 임직원 이름, Member ID, 이메일을 가져와 면접관으로 등록합니다.
- Slack 채널 검색으로 포지션별 채용 채널을 연결합니다.
- 비공개 채널은 Slack 앱을 해당 채널에 초대해야 검색·발송이 가능합니다.
- 일정 조율 메시지는 채널 또는 개인 DM으로 보낼 수 있습니다.
- 리마인드는 최초 일정 조율 발송 방식과 동일하게 발송됩니다.
  - 채널로 보낸 건은 채널에 미제출 면접관을 멘션합니다.
  - DM으로 보낸 건은 미제출 면접관에게 DM을 보냅니다.
- 면접관 전원이 제출하면 알림 수신 담당자에게 DM이 발송됩니다.
- 인터뷰가 확정되면 참여 면접관에게 확정 안내가 자동 발송됩니다.
  - 채널 발송 건은 채널에 전체 확정 안내를 보냅니다.
  - DM 발송 건은 각 면접관에게 본인 담당 일정 중심으로 안내합니다.

### Slack 앱 권한

Slack 앱의 Bot Token Scopes에는 최소 아래 권한이 필요합니다.

| 권한 | 용도 |
|---|---|
| `chat:write` | 채널 및 DM 메시지 발송 |
| `users:read` | Slack 사용자 검색 |
| `users:read.email` | 사용자 이메일 조회 |
| `channels:read` | 공개 채널 검색 |
| `groups:read` | 비공개 채널 검색 |

권한을 추가한 뒤에는 워크스페이스 관리자 승인과 앱 재설치가 필요할 수 있습니다.

### Slack 앱 설정

1. [api.slack.com/apps](https://api.slack.com/apps)에서 앱을 선택합니다.
2. **OAuth & Permissions**에서 Bot User OAuth Token을 확인합니다.
3. `.env.local`과 Vercel 환경변수에 `SLACK_BOT_TOKEN`을 등록합니다.
4. **Basic Information**에서 Signing Secret을 확인합니다.
5. `.env.local`과 Vercel 환경변수에 `SLACK_SIGNING_SECRET`을 등록합니다.
6. **Interactivity & Shortcuts**를 켭니다.
7. Request URL을 아래 형식으로 설정합니다.

```text
https://hunet-interview-scheduler.vercel.app/api/slack/interactive
```

로컬에서 Slack 버튼 제출까지 테스트하려면 Slack이 접근 가능한 터널 URL이 필요합니다. `localhost`는 Slack에서 직접 호출할 수 없습니다.

### 비공개 채널에 앱 초대

비공개 채널은 앱이 채널 멤버여야 검색과 메시지 발송이 가능합니다.

```text
/invite @봇이름
```

채널마다 한 번만 초대하면 됩니다.

---

## 기술 스택

| 항목 | 기술 |
|---|---|
| 언어 | TypeScript |
| 프레임워크 | Next.js 16 App Router |
| UI | Tailwind CSS v4, shadcn/ui, lucide-react |
| 상태 관리 | TanStack Query |
| 인증 | Firebase Authentication, Firebase Admin SDK |
| 데이터베이스 | Firebase Firestore |
| Slack | Slack Web API |
| 테스트 | Vitest, Playwright |
| 배포 | GitHub Actions, Vercel |

---

## 로컬 개발 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해서 `.env.local`을 만들고 값을 채웁니다.

```bash
cp .env.example .env.local
```

| 환경변수 | 설명 | 발급 위치 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 클라이언트 키 | Firebase 콘솔 → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 인증 도메인 | Firebase 콘솔 → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID | Firebase 콘솔 → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase 스토리지 버킷 | Firebase 콘솔 → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 메시징 ID | Firebase 콘솔 → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 앱 ID | Firebase 콘솔 → 프로젝트 설정 |
| `FIREBASE_ADMIN_PROJECT_ID` | Admin SDK 프로젝트 ID | Firebase 콘솔 → 서비스 계정 |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Admin SDK 클라이언트 이메일 | Firebase 콘솔 → 서비스 계정 |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Admin SDK 비공개 키 | Firebase 콘솔 → 서비스 계정 |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token | Slack API → OAuth & Permissions |
| `SLACK_SIGNING_SECRET` | Slack 요청 서명 검증 키 | Slack API → Basic Information |
| `CRON_SECRET` | Vercel Cron 인증 토큰 | 임의의 긴 문자열 |
| `ROOM_SYNC_API_KEY` | 회의실 예약 동기화 API 키 | 외부 회의실 연동 사용 시 |

### 3. Firebase 초기 설정

Firebase 콘솔에서 아래 설정이 필요합니다.

- Authentication → Sign-in method → 이메일/비밀번호 사용 설정.
- Firestore → `users` 컬렉션에 첫 관리자 계정 문서 생성.

첫 관리자 계정은 Firebase Authentication에서 만든 뒤, 아래 스크립트의 UID·이메일·이름을 수정해 실행합니다.

```bash
node scripts/seed-admin.mjs
```

### 4. 개발 서버 실행

```bash
npm run dev
```

Windows PowerShell에서 실행 정책 때문에 `npm`이 막히면 아래처럼 실행합니다.

```bash
npm.cmd run dev
```

---

## 검증 명령

코드를 변경했다면 아래 명령을 확인합니다.

```bash
npm run test
npm run lint
npm run build
npm run test:e2e
```

현재 `npm run lint`는 `react-hooks/set-state-in-effect` 기존 경고가 남아 있을 수 있습니다. 오류가 아니면 빌드와 배포는 진행됩니다.

Playwright는 기본적으로 headless 모드로 실행됩니다. 브라우저 창이 화면에 보이지 않아도 테스트는 정상 실행됩니다.

---

## 배포

이 프로젝트는 `vercel.json`에서 Vercel GitHub 자동 배포를 끄고, GitHub Actions에서 Vercel CLI로 프로덕션 배포합니다.

배포 흐름은 아래와 같습니다.

1. `main` 브랜치에 푸시합니다.
2. GitHub Actions가 `lint`, `test`, `build`를 실행합니다.
3. 성공하면 `npx vercel --prod`로 운영 배포합니다.

```bash
git push origin main
```

필요한 GitHub Secrets는 아래와 같습니다.

| Secret | 용도 |
|---|---|
| `VERCEL_TOKEN` | Vercel CLI 배포 인증 |
| `VERCEL_ORG_ID` | Vercel 조직 ID |
| `VERCEL_PROJECT_ID` | Vercel 프로젝트 ID |
| Firebase 관련 환경변수 | 빌드 시 Firebase 설정 |
| `SLACK_BOT_TOKEN` | Slack API 라우트 빌드·실행 |

Vercel 환경변수를 수정했다면 Vercel 프로젝트 설정에서 값을 바꾼 뒤 재배포해야 합니다.

---

## 주요 상태값

인터뷰 상태는 아래 흐름으로 사용됩니다.

| 상태 | 의미 |
|---|---|
| `pending_slack` | 생성됐지만 아직 Slack 발송 전 |
| `collecting` | 면접관 가용 일정 수집 중 |
| `ready_to_schedule` | 전원 제출 완료, 일정 선택 가능 |
| `pending_candidate` | 후보자에게 제안할 옵션 조율 중 |
| `confirmed` | 최종 일정 확정 |

---

## Firebase 컬렉션

| 컬렉션 | 설명 |
|---|---|
| `users` | 시스템 사용자, 역할 |
| `interviewers` | 면접관 이름, Slack ID, 이메일 |
| `positions` | 포지션, 인터뷰 유형, 차수별 면접관, Slack 채널 |
| `interviews` | 인터뷰 조율 건, 상태, 가용 일정, 확정 일정, Slack 발송 방식 |
| `rooms` | 회의실 목록 |
| `roomReservations` | 회의실 예약 |
| `settings` | Slack 메시지 템플릿 등 시스템 설정 |
| `notificationRecipients` | 전원 제출 완료 알림 수신 담당자 |

---

## 아키텍처

헥사고날 아키텍처를 기준으로 의존 방향을 단순하게 유지합니다.

```text
src/
├── domain/
│   ├── model/          # 핵심 데이터 구조
│   ├── repository/     # 데이터 접근 인터페이스
│   └── service/        # 순수 비즈니스 로직
├── application/
│   └── usecase/        # TanStack Query 훅과 유스케이스
├── infrastructure/
│   └── firebase/       # Firestore 구현체
├── presentation/
│   └── components/     # React UI 컴포넌트
└── app/
    └── api/            # Next.js API Route Handlers
```

---

## 커밋 컨벤션

타입은 영어, 제목과 본문은 한글로 작성합니다.

```text
Feat 면접관 가용 일정 수동 입력 기능 추가

- 면접관별로 가능한 날짜와 시간대를 직접 입력 가능
- 전원 입력 완료 시 상태를 ready_to_schedule으로 자동 전환
```

| 타입 | 설명 |
|---|---|
| `Feat` | 새로운 기능 |
| `Fix` | 버그 수정 |
| `Refactor` | 리팩토링 |
| `Design` | UI 디자인 변경 |
| `Docs` | 문서 수정 |
| `Test` | 테스트 코드 |
| `Chore` | 빌드·설정 변경 |
