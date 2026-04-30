# 휴넷 면접 일정 조율 시스템

휴넷 채용 담당자의 면접 일정 조율 업무를 자동화하는 사내 웹 시스템입니다.  
면접관 가용 일정 수집 → 교집합 자동 추천 → 확정 → 캘린더 등록까지 한 곳에서 처리합니다.

## 주요 기능

| 페이지 | 기능 | 상태 |
|---|---|---|
| 면접관 관리 | 면접관 추가·수정·삭제, 슬랙 ID 관리 | ✅ 완료 |
| 포지션 관리 | 채용 포지션 및 차수별 면접관 배치 | ✅ 완료 |
| 캘린더 | 주간·일간 뷰, 회의실 예약 관리 | ✅ 완료 |
| 일정 조율 | 면접 생성, 가용 일정 수집, 자동 추천, 확정 | 🚧 개발 중 |
| 대시보드 | 이번 주 면접 현황, 조율 대기 요약 | 🚧 개발 중 |

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

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 값을 채웁니다.  
Firebase 값은 [Firebase 콘솔](https://console.firebase.google.com) → 프로젝트 설정에서 확인할 수 있습니다.

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

SLACK_BOT_TOKEN=
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속합니다.

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

## Firebase 컬렉션

| 컬렉션 | 설명 |
|---|---|
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
