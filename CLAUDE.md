@AGENTS.md

# Interview Scheduler

휴넷 채용 담당자의 면접 일정 조율 업무를 자동화하는 웹 시스템.

## 기술 스택

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Firebase Firestore (클라이언트 SDK)
- TanStack Query (서버 상태 관리)
- date-fns (날짜 처리)
- lucide-react (아이콘) / sonner (토스트)
- Slack Web API (@slack/web-api)

## 빌드 & 실행

```bash
npm run dev        # 개발 서버 (포트 3000)
npm run build      # 프로덕션 빌드
npm run lint       # 린트
npm run test       # 테스트 단발 실행
npm run test:watch # 테스트 감시 모드 (개발 중 사용)
```

## 배포 & CI/CD

- **운영 URL**: https://hunet-interview-scheduler.vercel.app
- **배포 플랫폼**: Vercel — `main` 브랜치에 푸시하면 자동 배포
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — 푸시/PR 시 자동 실행

### CI 실행 순서

```
git push → 린트 → 테스트 → 빌드 → (전부 통과 시) Vercel 자동 배포
```

### 배포 전 필수 절차

**모든 배포는 아래 순서를 따른다.**

```
Playwright UX 테스트 → 사용자 확인 → 푸시 → 자동 배포
```

- 앱 코드가 변경된 경우: 반드시 Playwright로 화면 동작을 직접 확인한 뒤 배포한다.
- 앱 코드 변경 없이 설정·워크플로우·환경변수만 바뀐 경우에도: 푸시 전 반드시 사용자에게 먼저 물어본다.
- **Playwright 테스트를 건너뛰어야 하는 상황이 발생하면**: 이유를 설명하고 사용자에게 먼저 허락을 받는다. 임의로 생략하지 않는다.

### 패키지 설치 시 필수 규칙

새 패키지를 설치하면 반드시 `package-lock.json`도 함께 커밋한다.
빠뜨리면 CI에서 `npm ci` 단계가 실패한다.

```bash
npm install 패키지명
git add package.json package-lock.json
git commit -m "Chore 패키지 추가"
```

### 환경변수 관리

- 로컬: `.env.local` (gitignore 처리, 절대 커밋 금지)
- Vercel: 대시보드 Settings → Environment Variables에서 관리
- GitHub Actions: 저장소 Settings → Secrets and variables → Actions에서 관리
- 새 환경변수 추가 시 세 곳 모두 등록해야 한다

## 아키텍처 (Hexagonal)

의존성 방향을 **반드시** 준수한다.

```
presentation → application → domain (단방향만 허용)
infrastructure → domain (인터페이스 구현)
```

### 계층 구조

```
src/
├── domain/
│   ├── model/          # 순수 TypeScript 인터페이스 (프레임워크 의존 금지)
│   ├── repository/     # 리포지토리 인터페이스 (포트)
│   └── service/        # 도메인 서비스 (순수 비즈니스 로직, 프레임워크 의존 금지)
│
├── application/
│   └── usecase/        # TanStack Query 훅 (유스케이스 오케스트레이션)
│
├── infrastructure/
│   └── firebase/       # Firestore 리포지토리 구현체
│
├── presentation/
│   └── components/     # React 컴포넌트 (UI만 담당, 비즈니스 로직 금지)
│
└── app/                # Next.js App Router 페이지 (라우팅만)
```

### 의존성 규칙

- **domain** → 어떤 계층에도 의존하지 않는다 (순수 TypeScript)
- **application** → domain에만 의존한다
- **infrastructure** → domain 인터페이스를 구현한다
- **presentation** → application(usecase 훅)을 통해서만 데이터에 접근한다

## 코드 패턴

### Domain Model

순수 TypeScript `interface`로 선언. `id`와 타임스탬프 필수.

```ts
/** 설명 — KDoc 스타일 JSDoc 필수 */
export interface Interviewer {
  id: string
  name: string
  slackId: string
  createdAt: Date
  updatedAt: Date
}
```

### Repository Interface

파일명 `I{Entity}Repository.ts`. Input 타입을 같은 파일에 함께 선언.

```ts
export interface CreateInterviewerInput { ... }
export interface UpdateInterviewerInput { ... }

export interface IInterviewerRepository {
  findAll(): Promise<Interviewer[]>
  create(input: CreateInterviewerInput): Promise<Interviewer>
  update(id: string, input: UpdateInterviewerInput): Promise<Interviewer>
  delete(id: string): Promise<void>
}
```

### Infrastructure (Firestore)

- Firestore doc → domain model 변환은 `toXxx(id, data)` 함수로 분리
- 클래스로 인터페이스 구현 후 **싱글톤 인스턴스**로 export

```ts
function toInterviewer(id: string, data: Record<string, unknown>): Interviewer { ... }

class InterviewerFirestoreRepository implements IInterviewerRepository { ... }

export const interviewerRepository = new InterviewerFirestoreRepository()
```

### Application (TanStack Query 훅)

- 파일 위치: `application/usecase/{도메인}/use{Entity}s.ts`
- Query Key 상수를 파일 상단에 선언

```ts
export const INTERVIEWERS_KEY = ['interviewers']

export function useInterviewers() { ... }
export function useCreateInterviewer() { ... }
```

### Presentation (React 컴포넌트)

- 비즈니스 로직은 usecase 훅에서만. 컴포넌트는 UI만 담당
- 페이지 컴포넌트(`app/*/page.tsx`)는 라우팅 진입점만. 실제 UI는 `presentation/components/`

## Firebase 컬렉션

`infrastructure/firebase/collections.ts`의 `COLLECTIONS` 상수로만 참조한다.

| 상수 키 | 컬렉션명 | 용도 |
|---|---|---|
| `POSITIONS` | `positions` | 채용 포지션 |
| `INTERVIEWERS` | `interviewers` | 면접관 명부 |
| `INTERVIEWS` | `interviews` | 면접 조율 건 |
| `ROOMS` | `rooms` | 회의실 |
| `ROOM_RESERVATIONS` | `roomReservations` | 회의실 예약 |

## 비즈니스 규칙

- 근무일: 월~금 (주 4일제: 월~목 기준)
- 면접 가능 시간대: 09:00~18:00
- 점심 시간: 12:00~13:00 (면접 배정 제외)
- 면접 라운드: 1차(실무진) / 2차(임원+HR) / 3차(CEO)
- 원데이 인터뷰: 1차+2차를 같은 날 같은 회의실에서 연속 진행

### Interview 상태 흐름

```
pending_slack → collecting → ready_to_schedule → confirmed
(생성됨)      (수집 중)    (전원 입력 완료)    (확정)
```

## 지침 동기화 규칙

- 사용자가 앞으로 어떤 규칙을 `AGENTS.md`에 추가해 달라고 요청하면, 같은 규칙을 `CLAUDE.md`에도 동일하게 추가한다.
## 코드 규칙

- 모든 인터페이스/함수에 JSDoc 한 줄 이상 필수 (한글 권장)
- 함수 본문 40줄 이하. 초과 시 private 함수로 추출
- `infrastructure/` 계층에서만 Firebase SDK를 직접 import한다
- `presentation/` 컴포넌트에서 Firestore/Firebase를 직접 import 금지
- 새 컬렉션 추가 시 반드시 `COLLECTIONS` 상수에 등록
