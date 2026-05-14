# 휴넷 면접 일정 조율 시스템

휴넷 채용 담당자의 면접 일정 조율 업무를 자동화하는 사내 웹 시스템입니다.  
면접관 가용 일정 수집 → 교집합 자동 추천 → 확정 → 캘린더 등록까지 한 곳에서 처리합니다.

- **운영 URL**: https://hunet-interview-scheduler.vercel.app
- **배포 플랫폼**: Vercel (Hobby 무료 플랜)
- **GitHub**: https://github.com/redbuttonking/hunet-interview-scheduler

---

## 구현된 기능

| 페이지 | 기능 |
|---|---|
| 로그인 | 이메일+비밀번호 인증, 비활성 1시간 자동 로그아웃 |
| 계정 관리 `/admin/users` | 관리자 전용 — 사용자 추가·삭제·역할 변경, 신규 계정 비밀번호 설정 메일 자동 발송 |
| 면접관 관리 `/interviewers` | 면접관 추가·수정·삭제, 슬랙 Member ID 관리 |
| 포지션 관리 `/positions` | 채용 포지션·인터뷰 유형·차수별 면접관 배치, 슬랙 채널 ID 등록 |
| 캘린더 `/calendar` | 주간·일간 뷰, 드래그로 회의실 예약 생성, 중복 예약 방지 |
| 일정 조율 `/scheduling` | 면접 생성, 슬랙 발송, 가용 일정 수동 입력, 자동 추천, 확정·취소 |
| 대시보드 `/dashboard` | 예정 면접 목록, 조율 대기 현황, 상태별 필터 |
| 설정 `/settings` | 관리자 전용 데이터 초기화 (컬렉션별 선택 삭제) |

---

## 기술 스택

| 항목 | 기술 |
|---|---|
| 언어 | TypeScript |
| 프레임워크 | Next.js 16 (App Router) |
| 스타일 | Tailwind CSS v4 + shadcn/ui |
| 데이터베이스 | Firebase Firestore |
| 인증 | Firebase Authentication + Firebase Admin SDK |
| 서버 상태 관리 | TanStack Query |
| 날짜 처리 | date-fns |
| 슬랙 연동 | Slack Web API (`@slack/web-api`) |
| 배포 | Vercel |

---

## 로컬 개발 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해서 `.env.local`을 만들고 값을 채웁니다.  
실제 값은 관리자에게 별도로 전달받습니다.

```bash
cp .env.example .env.local
```

| 환경변수 | 설명 | 발급 위치 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 클라이언트 키 | Firebase 콘솔 → 프로젝트 설정 → 일반 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 인증 도메인 | 동일 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID | 동일 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase 스토리지 버킷 | 동일 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 메시징 ID | 동일 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 앱 ID | 동일 |
| `FIREBASE_ADMIN_PROJECT_ID` | Admin SDK 프로젝트 ID | Firebase 콘솔 → 서비스 계정 → 새 비공개 키 생성 |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Admin SDK 클라이언트 이메일 | 동일 |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Admin SDK 비공개 키 | 동일 (따옴표 포함해서 입력) |
| `SLACK_BOT_TOKEN` | 슬랙 봇 토큰 | Slack API → 앱 → OAuth & Permissions |

### 3. Firebase 초기 설정

Firebase 콘솔에서 아래 두 가지를 활성화해야 합니다.

- **Authentication** → Sign-in method → 이메일/비밀번호 사용 설정
- **Firestore** → `users` 컬렉션에 첫 관리자 계정 문서 생성

첫 관리자 계정은 Firebase 콘솔 → Authentication에서 직접 생성 후, 아래 스크립트로 Firestore 문서를 추가합니다.

```bash
# scripts/seed-admin.mjs 내 UID·이메일·이름 수정 후 실행
node scripts/seed-admin.mjs
```

### 4. 개발 서버 실행

```bash
npm run dev       # 개발 서버 (http://localhost:3000)
npm run build     # 프로덕션 빌드
npm run lint      # 린트 검사
```

---

## 슬랙 봇 설정

### 봇 토큰 발급

1. [api.slack.com/apps](https://api.slack.com/apps) → 앱 선택
2. **OAuth & Permissions** → **Install to Workspace**
3. `xoxb-`로 시작하는 Bot User OAuth Token 복사
4. `.env.local`의 `SLACK_BOT_TOKEN`에 입력

### 슬랙 ID 종류

| 종류 | 형식 | 용도 |
|---|---|---|
| Member ID | `U0123456789` | 면접관 개인 DM 발송 |
| Channel ID | `C0123456789` | 채널 메시지 발송 |

Member ID 확인 방법: 슬랙에서 해당 사람 프로필 → 더보기(⋯) → **Copy member ID**  
Channel ID 확인 방법: 채널 우클릭 → **Copy link** → URL 마지막 부분

### 채널에 봇 초대

채널로 메시지를 보내려면 봇을 해당 채널에 초대해야 합니다.  
채널에서 아래 명령어 입력:

```
/invite @봇이름
```

채널마다 한 번만 초대하면 이후 계속 사용 가능합니다.

### 발송 방식

- **면접관 1명**: 개인 DM으로 발송
- **면접관 2명 이상 + 채널 ID 등록된 포지션**: 채널 발송 / 개인 DM 중 선택 가능
- 발송 실패 시 면접 상태가 `수집 중`으로 넘어가지 않음

---

## Vercel 배포

### 최초 배포

1. [vercel.com](https://vercel.com) → GitHub 계정으로 로그인
2. **Add New Project** → `redbuttonking/hunet-interview-scheduler` 선택
3. **Environment Variables**에 위 환경변수 전부 입력
4. **Deploy** 클릭

### 코드 업데이트 배포

`main` 브랜치에 푸시하면 Vercel이 자동으로 재배포합니다.

```bash
git push origin main
```

### Vercel 환경변수 수정

[vercel.com](https://vercel.com) → 프로젝트 → **Settings** → **Environment Variables**에서 수정 후 재배포 필요.

---

## 환경변수 관리 원칙

- `.env.local`은 `.gitignore`에 의해 Git에서 제외됩니다 — 절대 커밋하지 않습니다.
- `.env.example`은 키 이름만 담은 템플릿으로 Git에 포함됩니다.
- 실제 값은 팀 내부(슬랙 등)로만 공유합니다.
- 키가 외부에 유출됐을 경우 즉시 재발급 후 Vercel 환경변수도 함께 교체합니다.

---

## 아키텍처

헥사고날 아키텍처를 적용했습니다. 의존성은 `presentation → application → domain` 단방향만 허용합니다.

```
src/
├── domain/
│   ├── model/          # 핵심 데이터 구조 (Interviewer, Position, Interview, Room)
│   ├── repository/     # 데이터 접근 인터페이스
│   └── service/        # 순수 비즈니스 로직 (일정 추천 알고리즘 등)
│
├── application/
│   └── usecase/        # TanStack Query 훅 (데이터 조회·수정 오케스트레이션)
│
├── infrastructure/
│   └── firebase/       # Firestore 실제 구현체
│
├── presentation/
│   └── components/     # React UI 컴포넌트
│
└── app/                # Next.js 라우팅 (페이지 진입점)
    └── api/            # API Route Handlers (슬랙 발송, 계정 관리 등)
```

---

## 인증 구조

- **방식**: Firebase Auth 이메일+비밀번호
- **세션 유지**: LOCAL (브라우저 로컬 저장소) — 컴퓨터를 꺼도 로그인 유지
- **자동 로그아웃**: 마지막 동작(마우스·키보드·스크롤)으로부터 1시간 경과 시 자동 로그아웃
- **역할**: `admin`(관리자) / `recruiter`(채용담당자)
  - 관리자만 `/admin/users` 접근 가능
  - 신규 계정 생성 시 비밀번호 설정 이메일 자동 발송

---

## Firebase 컬렉션

| 컬렉션 | 설명 |
|---|---|
| `users` | 시스템 사용자 (uid, email, name, role) |
| `interviewers` | 면접관 명부 (name, slackId) |
| `positions` | 채용 포지션 (name, interviewTypes, interviewersByRound, slackChannelId) |
| `interviews` | 면접 조율 건 (candidateName, positionName, status 등) |
| `rooms` | 회의실 목록 |
| `roomReservations` | 회의실 예약 |
| `settings` | 시스템 설정 (슬랙 메시지 템플릿 등) |

---

## 커밋 컨벤션

타입은 영어, 제목과 본문은 한글로 작성합니다.

```
Feat 면접관 가용 일정 수동 입력 기능 추가

- 면접관별로 가능한 날짜/시간대를 직접 입력 가능
- 전원 입력 완료 시 상태를 ready_to_schedule로 자동 전환
```

| 타입 | 설명 |
|---|---|
| `Feat` | 새로운 기능 |
| `Fix` | 버그 수정 |
| `Refactor` | 리팩토링 |
| `Design` | UI 디자인 변경 |
| `Docs` | 문서 수정 |
| `Chore` | 빌드·설정 변경 |
