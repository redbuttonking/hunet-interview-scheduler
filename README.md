# 휴넷 면접 일정 조율 시스템

휴넷 채용 담당자의 면접 일정 조율 업무를 자동화하는 사내 웹 시스템입니다.  
면접관 가용 일정 수집 → 교집합 자동 추천 → 확정 → 캘린더 등록까지 한 곳에서 처리합니다.

## 주요 기능

| 페이지 | 기능 | 상태 |
|---|---|---|
| 로그인 | 이메일+비밀번호 인증, 비활성 1시간 자동 로그아웃 | ✅ 완료 |
| 계정 관리 | 관리자 전용 — 사용자 추가·삭제·역할 변경 | ✅ 완료 |
| 면접관 관리 | 면접관 추가·수정·삭제, 슬랙 ID 관리 | ✅ 완료 |
| 포지션 관리 | 채용 포지션 및 차수별 면접관 배치 | ✅ 완료 |
| 캘린더 | 주간·일간 뷰, 회의실 예약 관리 | ✅ 완료 |
| 일정 조율 | 면접 생성, 가용 일정 수집, 자동 추천, 확정 | ✅ 완료 |
| 대시보드 | 이번 주 면접 현황, 조율 대기 요약 | ✅ 완료 |

## 기술 스택

- **프레임워크**: Next.js 15 (App Router) + TypeScript
- **스타일**: Tailwind CSS v4 + shadcn/ui
- **데이터베이스**: Firebase Firestore
- **상태 관리**: TanStack Query
- **외부 연동**: Slack Web API

## 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해서 `.env.local`을 만들고 값을 채웁니다.  
실제 값은 관리자에게 별도로 전달받습니다 (슬랙 등 사내 채널 이용).

```bash
cp .env.example .env.local
```

```
# Firebase 클라이언트 SDK (Firebase 콘솔 > 프로젝트 설정 > 일반)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=""

# Slack Bot Token (Slack API > 앱 설정 > OAuth & Permissions)
SLACK_BOT_TOKEN=
```

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
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속하면 로그인 페이지로 이동합니다.

## 환경변수 관리 원칙

- `.env.local`은 `.gitignore`에 의해 Git에서 제외됩니다 — 절대 커밋하지 않습니다.
- `.env.example`은 키 이름만 담은 템플릿으로 Git에 포함됩니다.
- 실제 값은 팀 내부(슬랙 등)로만 공유합니다.

**새 키 발급이 필요한 경우**
- 키가 외부에 유출됐을 때
- 퇴사자가 키를 알고 있어서 접근을 차단해야 할 때
- 개발/스테이징/운영 환경을 별도 Firebase 프로젝트로 분리할 때

**같은 프로젝트에서 개발할 때는 동일한 키를 공유해서 사용합니다.** 개발자마다 새 키를 발급받지 않습니다.

## 프로젝트 구조

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
```

## 인증 구조

- **방식**: Firebase Auth 이메일+비밀번호
- **세션 유지**: LOCAL (브라우저 로컬 저장소) — 컴퓨터를 꺼도 로그인 유지
- **자동 로그아웃**: 마지막 동작(마우스·키보드·스크롤)으로부터 1시간 경과 시 자동 로그아웃
- **역할**: `admin`(관리자) / `recruiter`(채용담당자)
  - 관리자만 `/admin/users` 접근 가능 (계정 추가·삭제·역할 변경)
  - 신규 계정 생성 시 비밀번호 설정 이메일 자동 발송

## Firebase 컬렉션

| 컬렉션 | 설명 |
|---|---|
| `users` | 시스템 사용자 (uid, email, name, role) |
| `interviewers` | 면접관 명부 |
| `positions` | 채용 포지션 |
| `interviews` | 면접 조율 건 |
| `rooms` | 회의실 목록 |
| `roomReservations` | 회의실 예약 |

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
