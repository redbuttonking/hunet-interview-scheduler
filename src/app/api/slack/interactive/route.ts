// 슬랙 인터랙티브 메시지 이벤트 처리 (버튼 클릭, 모달 제출)
import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { FieldValue } from 'firebase-admin/firestore'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

// 09:00~17:30 (시작), 09:30~18:00 (종료) — 30분 단위 드롭다운 옵션
function buildTimeOptions(startMin: number, endMin: number) {
  const options = []
  for (let m = startMin; m <= endMin; m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    options.push({ text: { type: 'plain_text' as const, text: t }, value: t })
  }
  return options
}
const START_OPTIONS = buildTimeOptions(9 * 60, 17 * 60 + 30)
const END_OPTIONS = buildTimeOptions(9 * 60 + 30, 18 * 60)
const CUSTOM_SLOT_COUNT = 3

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

  // 인터뷰 존재 확인 — 삭제된 경우 원본 메시지를 비활성화하고 종료
  const db = adminDb()
  const interviewSnap = await db.collection(COLLECTIONS.INTERVIEWS).doc(buttonValue.interviewId).get()
  if (!interviewSnap.exists) {
    const container = payload.container as Record<string, unknown> | undefined
    const messageTs = container?.message_ts as string | undefined
    const channelId = container?.channel_id as string | undefined
    if (messageTs && channelId) {
      try {
        await slack.chat.update({
          channel: channelId,
          ts: messageTs,
          text: '취소된 인터뷰 일정입니다.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `~*${buttonValue.candidateName}* · ${buttonValue.positionName}~\n이 인터뷰 일정은 취소되었습니다.`,
              },
            },
          ],
        })
      } catch (e) {
        console.error('[slack/interactive] 메시지 업데이트 실패:', (e as Error).message)
      }
    }
    return
  }

  // 날짜별 오전/오후 체크박스 + 직접 시간 지정 드롭다운 블록 생성
  const dateBlocks = buttonValue.dates.flatMap((date) => {
    const [, month, day] = date.split('-')
    const d = new Date(date)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const label = `${month}월 ${day}일 (${weekdays[d.getDay()]})`

    const customSlotBlocks = Array.from({ length: CUSTOM_SLOT_COUNT }, (_, idx) => ({
      type: 'actions',
      block_id: `custom_${date}_${idx}`,
      elements: [
        {
          type: 'static_select',
          action_id: `cs_${date}_${idx}`,
          placeholder: { type: 'plain_text', text: '시작' },
          options: START_OPTIONS,
        },
        {
          type: 'static_select',
          action_id: `ce_${date}_${idx}`,
          placeholder: { type: 'plain_text', text: '종료' },
          options: END_OPTIONS,
        },
      ],
    }))

    return [
      { type: 'section', text: { type: 'mrkdwn', text: `*${label}*` } },
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
      {
        type: 'context',
        elements: [{ type: 'plain_text', text: '직접 시간 지정' }],
      },
      ...customSlotBlocks,
      { type: 'divider' },
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
        {
          type: 'context',
          elements: [{ type: 'plain_text', text: '체크 시 아래 날짜별 선택은 무시됩니다.' }],
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

  let interviewerId: string
  if (interviewerSnap.empty) {
    // 미등록 면접관 — 슬랙 프로필로 자동 등록
    const userInfo = await slack.users.info({ user: slackUserId })
    const user = userInfo.user as Record<string, unknown> | undefined
    const name = (user?.real_name as string) || (user?.name as string) || '미지정'
    const ref = await db.collection(COLLECTIONS.INTERVIEWERS).add({
      name,
      slackId: slackUserId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    interviewerId = ref.id
  } else {
    interviewerId = interviewerSnap.docs[0].id
  }

  // 전체 가능 여부 확인
  const allAvailableBlock = stateValues.values['all_available_block']
  const allAvailableAction = allAvailableBlock?.['all_available'] as { selected_options?: { value: string }[] } | undefined
  const allAvailable = allAvailableAction?.selected_options?.some((o) => o.value === 'all') ?? false

  const slots: { date: string; startTime: string; endTime: string }[] = []

  if (!allAvailable) {
    // 날짜별 오전/오후 체크박스 + 직접 입력 시간대 수집
    for (const [blockId, actions] of Object.entries(stateValues.values)) {
      if (blockId.startsWith('date_')) {
        // 오전/오후 체크박스 — block_id: date_2026-05-19
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
      } else if (blockId.startsWith('custom_')) {
        // 직접 입력 — block_id: custom_2026-05-19_0
        const parts = blockId.split('_')
        const date = parts[1]   // '2026-05-19'
        const idx = parts[2]    // '0' | '1' | '2'
        const startAction = actions[`cs_${date}_${idx}`] as { selected_option?: { value: string } } | undefined
        const endAction = actions[`ce_${date}_${idx}`] as { selected_option?: { value: string } } | undefined
        const startTime = startAction?.selected_option?.value
        const endTime = endAction?.selected_option?.value
        if (startTime && endTime && startTime < endTime) {
          slots.push({ date, startTime, endTime })
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

  try {
    if (payload.type === 'block_actions') {
      await handleBlockAction(payload)
    } else if (payload.type === 'view_submission') {
      await handleViewSubmission(payload)
      // 슬랙에 모달 닫기 응답
      return NextResponse.json({ response_action: 'clear' })
    }
  } catch (err) {
    // 슬랙은 200이 아니면 사용자에게 dispatch_failed를 표시하므로 항상 200 반환
    console.error('[slack/interactive] 처리 오류:', (err as Error).message)
  }

  return NextResponse.json({ ok: true })
}
