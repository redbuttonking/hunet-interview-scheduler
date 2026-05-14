// 슬랙 인터랙티브 메시지 이벤트 처리 (버튼 클릭, 모달 제출)
import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { FieldValue } from 'firebase-admin/firestore'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

// 슬랙 서명 검증
async function verifySlackSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) return false

  const timestamp = req.headers.get('x-slack-request-timestamp')
  const slackSignature = req.headers.get('x-slack-signature')
  if (!timestamp || !slackSignature) return false

  // 5분 이상 지난 요청 거부 (리플레이 공격 방지)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false

  const baseString = `v0:${timestamp}:${rawBody}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString))
  const hex = 'v0=' + Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('')

  return hex === slackSignature
}

// 버튼 클릭 처리 — 가용 일정 입력 모달 열기
async function handleBlockAction(payload: Record<string, unknown>) {
  const action = (payload.actions as Record<string, unknown>[])?.[0]
  if (!action || action.action_id !== 'open_availability') return

  const triggerId = payload.trigger_id as string
  const buttonValue = JSON.parse(action.value as string) as {
    interviewId: string
    dates: string[]
    candidateName: string
    positionName: string
  }

  // 날짜별 오전/오후 체크박스 블록 생성
  const dateBlocks = buttonValue.dates.flatMap((date) => {
    const [year, month, day] = date.split('-')
    const d = new Date(date)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const label = `${month}월 ${day}일 (${weekdays[d.getDay()]})`
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${label}*` },
      },
      {
        type: 'actions',
        block_id: `date_${date}`,
        elements: [
          {
            type: 'checkboxes',
            action_id: `slots_${date}`,
            options: [
              { text: { type: 'plain_text', text: '오전 (09:00~12:00)' }, value: `${date}_AM` },
              { text: { type: 'plain_text', text: '오후 (13:00~18:00)' }, value: `${date}_PM` },
            ],
          },
        ],
      },
    ]
  })

  await slack.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'availability_submit',
      private_metadata: JSON.stringify({ interviewId: buttonValue.interviewId }),
      title: { type: 'plain_text', text: '가용 일정 선택' },
      submit: { type: 'plain_text', text: '제출' },
      close: { type: 'plain_text', text: '취소' },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${buttonValue.candidateName}* · ${buttonValue.positionName}\n가능한 날짜와 시간대를 선택해주세요.`,
          },
        },
        {
          type: 'actions',
          block_id: 'all_available_block',
          elements: [
            {
              type: 'checkboxes',
              action_id: 'all_available',
              options: [
                { text: { type: 'plain_text', text: '전체 기간 모두 가능' }, value: 'all' },
              ],
            },
          ],
        },
        { type: 'divider' },
        ...dateBlocks,
      ],
    },
  })
}

// 모달 제출 처리 — 가용 일정 Firestore 저장
async function handleViewSubmission(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>
  if ((view.callback_id as string) !== 'availability_submit') return

  const slackUserId = (payload.user as Record<string, unknown>).id as string
  const { interviewId } = JSON.parse(view.private_metadata as string) as { interviewId: string }
  const stateValues = view.state as { values: Record<string, Record<string, unknown>> }

  // 슬랙 유저 ID로 면접관 조회
  const db = adminDb()
  const interviewerSnap = await db
    .collection(COLLECTIONS.INTERVIEWERS)
    .where('slackId', '==', slackUserId)
    .limit(1)
    .get()

  if (interviewerSnap.empty) return

  const interviewerId = interviewerSnap.docs[0].id

  // 전체 가능 여부 확인
  const allAvailableBlock = stateValues.values['all_available_block']
  const allAvailableAction = allAvailableBlock?.['all_available'] as { selected_options?: { value: string }[] } | undefined
  const allAvailable = allAvailableAction?.selected_options?.some((o) => o.value === 'all') ?? false

  let slots: { date: string; startTime: string; endTime: string }[] = []

  if (!allAvailable) {
    // 날짜별 선택된 오전/오후 슬롯 수집
    for (const [blockId, actions] of Object.entries(stateValues.values)) {
      if (!blockId.startsWith('date_')) continue
      for (const action of Object.values(actions)) {
        const checkboxAction = action as { selected_options?: { value: string }[] }
        for (const option of checkboxAction.selected_options ?? []) {
          const [date, period] = option.value.split('_')
          slots.push({
            date,
            startTime: period === 'AM' ? '09:00' : '13:00',
            endTime: period === 'AM' ? '12:00' : '18:00',
          })
        }
      }
    }
  }

  // 인터뷰 문서에 가용 일정 업데이트
  const interviewRef = db.collection(COLLECTIONS.INTERVIEWS).doc(interviewId)
  const interviewSnap = await interviewRef.get()
  if (!interviewSnap.exists) return

  const interviewData = interviewSnap.data()!
  const existingAvailabilities = (interviewData.availabilities ?? []) as { interviewerId: string }[]
  const filtered = existingAvailabilities.filter((a) => a.interviewerId !== interviewerId)
  const updatedAvailabilities = [...filtered, { interviewerId, allAvailable, slots }]

  // 전원 입력 완료 시 상태 자동 전환
  const interviewerIds = interviewData.interviewerIds as string[]
  const allSubmitted = interviewerIds.every((id) =>
    updatedAvailabilities.some((a) => a.interviewerId === id),
  )

  await interviewRef.update({
    availabilities: updatedAvailabilities,
    status: allSubmitted ? 'ready_to_schedule' : 'collecting',
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const isValid = await verifySlackSignature(req, rawBody)
  if (!isValid) {
    return NextResponse.json({ error: '서명 검증 실패' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const payload = JSON.parse(params.get('payload') ?? '{}') as Record<string, unknown>

  if (payload.type === 'block_actions') {
    await handleBlockAction(payload)
  } else if (payload.type === 'view_submission') {
    await handleViewSubmission(payload)
    // 슬랙에 모달 닫기 응답
    return NextResponse.json({ response_action: 'clear' })
  }

  return NextResponse.json({ ok: true })
}
