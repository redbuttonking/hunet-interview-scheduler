// 슬랙 인터랙티브 메시지 이벤트 처리 (버튼 클릭, 모달 제출)
import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { FieldValue } from 'firebase-admin/firestore'
import type { Firestore, DocumentData } from 'firebase-admin/firestore'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

// 1시간 단위 체크박스 슬롯 (09:00~18:00, 12:00~13:00 제외)
const HOURLY_SLOTS = [
  { start: '09:00', end: '10:00', label: '오전 9시 ~ 10시' },
  { start: '10:00', end: '11:00', label: '오전 10시 ~ 11시' },
  { start: '11:00', end: '12:00', label: '오전 11시 ~ 12시' },
  { start: '13:00', end: '14:00', label: '오후 1시 ~ 2시' },
  { start: '14:00', end: '15:00', label: '오후 2시 ~ 3시' },
  { start: '15:00', end: '16:00', label: '오후 3시 ~ 4시' },
  { start: '16:00', end: '17:00', label: '오후 4시 ~ 5시' },
  { start: '17:00', end: '18:00', label: '오후 5시 ~ 6시' },
]

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
  const slackUserId = (payload.user as Record<string, unknown>).id as string
  const buttonValue = JSON.parse(action.value as string) as {
    interviewId: string
    dates: string[]
    candidateName: string
    positionName: string
  }

  const container = payload.container as Record<string, unknown> | undefined
  const messageTs = container?.message_ts as string | undefined
  const channelId = container?.channel_id as string | undefined

  // 원본 메시지 section 텍스트 추출 (제출 후 메시지 업데이트에 사용)
  const originalMessage = payload.message as Record<string, unknown> | undefined
  const originalBlocks = originalMessage?.blocks as { type: string; text?: { text: string } }[] | undefined
  const sectionText = originalBlocks?.find((b) => b.type === 'section')?.text?.text ?? ''

  // 인터뷰 존재 확인 — 삭제된 경우 원본 메시지를 비활성화하고 종료
  const db = adminDb()
  const interviewSnap = await db.collection(COLLECTIONS.INTERVIEWS).doc(buttonValue.interviewId).get()
  if (!interviewSnap.exists) {
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

  // 클릭한 사용자가 해당 인터뷰의 담당 면접관인지 검증
  const interviewerQuery = await db
    .collection(COLLECTIONS.INTERVIEWERS)
    .where('slackId', '==', slackUserId)
    .limit(1)
    .get()

  const interviewerIds = interviewSnap.data()!.interviewerIds as string[]
  const isAssigned = !interviewerQuery.empty && interviewerIds.includes(interviewerQuery.docs[0].id)

  if (!isAssigned) {
    if (channelId) {
      await slack.chat.postEphemeral({
        channel: channelId,
        user: slackUserId,
        text: '이 면접의 담당 면접관으로 지정되지 않았습니다. 일정을 제출하실 수 없습니다.',
      }).catch(() => {})
    }
    return
  }

  // 날짜별 1시간 단위 체크박스 블록 생성
  const dateBlocks = buttonValue.dates.flatMap((date) => {
    const [, month, day] = date.split('-')
    const d = new Date(date)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const label = `${month}월 ${day}일 (${weekdays[d.getDay()]})`

    return [
      { type: 'section', text: { type: 'mrkdwn', text: `*${label}*` } },
      {
        type: 'actions',
        block_id: `hourly_${date}`,
        elements: [
          {
            type: 'checkboxes',
            action_id: `slots_${date}`,
            options: HOURLY_SLOTS.map((slot) => ({
              text: { type: 'plain_text' as const, text: slot.label },
              value: `${date}_${slot.start}-${slot.end}`,
            })),
          },
        ],
      },
      { type: 'divider' },
    ]
  })

  await slack.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'availability_submit',
      private_metadata: JSON.stringify({ interviewId: buttonValue.interviewId, messageTs, channelId, sectionText }),
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

// 에러 모달 블록 생성 헬퍼
function errorModal(message: string) {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: '제출 불가' },
    close: { type: 'plain_text', text: '닫기' },
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: message } },
    ],
  }
}

// 모달 제출 처리 — 가용 일정 Firestore 저장
async function handleViewSubmission(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const view = payload.view as Record<string, unknown>
  if ((view.callback_id as string) !== 'availability_submit') return null

  const slackUserId = (payload.user as Record<string, unknown>).id as string
  const { interviewId, messageTs, channelId, sectionText } = JSON.parse(view.private_metadata as string) as {
    interviewId: string
    messageTs?: string
    channelId?: string
    sectionText?: string
  }
  const stateValues = view.state as { values: Record<string, Record<string, unknown>> }

  // 슬랙 유저 ID로 면접관 조회 — 미등록 사용자 차단
  const db = adminDb()
  const interviewerSnap = await db
    .collection(COLLECTIONS.INTERVIEWERS)
    .where('slackId', '==', slackUserId)
    .limit(1)
    .get()

  if (interviewerSnap.empty) {
    return { response_action: 'push', view: errorModal('등록된 면접관만 일정을 제출할 수 있습니다.\n시스템 관리자에게 문의해주세요.') }
  }

  const interviewerId = interviewerSnap.docs[0].id

  // 해당 인터뷰의 담당 면접관인지 확인
  const interviewRef = db.collection(COLLECTIONS.INTERVIEWS).doc(interviewId)
  const interviewDocSnap = await interviewRef.get()
  if (!interviewDocSnap.exists) return null

  const interviewData = interviewDocSnap.data()!
  const interviewerIds = interviewData.interviewerIds as string[]

  if (!interviewerIds.includes(interviewerId)) {
    return { response_action: 'push', view: errorModal('이 면접의 담당 면접관으로 지정되지 않아 일정을 제출할 수 없습니다.') }
  }

  // 전체 가능 여부 확인
  const allAvailableBlock = stateValues.values['all_available_block']
  const allAvailableAction = allAvailableBlock?.['all_available'] as { selected_options?: { value: string }[] } | undefined
  const allAvailable = allAvailableAction?.selected_options?.some((o) => o.value === 'all') ?? false

  const slots: { date: string; startTime: string; endTime: string }[] = []

  if (!allAvailable) {
    // 날짜별 1시간 단위 체크박스 수집 — block_id: hourly_YYYY-MM-DD
    for (const [blockId, actions] of Object.entries(stateValues.values)) {
      if (blockId.startsWith('hourly_')) {
        const date = blockId.slice('hourly_'.length)  // 'YYYY-MM-DD'
        for (const action of Object.values(actions)) {
          const checkboxAction = action as { selected_options?: { value: string }[] }
          for (const option of checkboxAction.selected_options ?? []) {
            // value 형식: 'YYYY-MM-DD_HH:MM-HH:MM'
            const timeRange = option.value.split('_')[1]  // 'HH:MM-HH:MM'
            const [startTime, endTime] = timeRange.split('-')  // ['HH:MM', 'HH:MM']
            slots.push({ date, startTime, endTime })
          }
        }
      }
    }
  }

  // 인터뷰 문서에 가용 일정 업데이트
  const existingAvailabilities = (interviewData.availabilities ?? []) as { interviewerId: string }[]
  const filtered = existingAvailabilities.filter((a) => a.interviewerId !== interviewerId)
  const updatedAvailabilities = [...filtered, { interviewerId, allAvailable, slots }]

  // 전원 입력 완료 시 상태 자동 전환
  const allSubmitted = interviewerIds.every((id) =>
    updatedAvailabilities.some((a) => a.interviewerId === id),
  )

  await interviewRef.update({
    availabilities: updatedAvailabilities,
    status: allSubmitted ? 'ready_to_schedule' : 'collecting',
    updatedAt: FieldValue.serverTimestamp(),
  })

  if (allSubmitted) {
    await notifyRecruiters(db, interviewData)
  }

  // 원본 슬랙 메시지의 버튼을 제출 완료 상태로 교체
  if (messageTs && channelId) {
    try {
      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: '✅ 제출 완료',
        blocks: [
          ...(sectionText ? [{ type: 'section' as const, text: { type: 'mrkdwn' as const, text: sectionText } }] : []),
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: '✅ *제출 완료*' }],
          },
        ],
      })
    } catch (e) {
      console.error('[slack/interactive] 버튼 상태 업데이트 실패:', (e as Error).message)
    }
  }

  return null
}

// 전원 제출 완료 시 채용 담당자들에게 슬랙 DM 발송
async function notifyRecruiters(
  db: Firestore,
  interviewData: DocumentData,
) {
  const recipientsSnap = await db.collection(COLLECTIONS.NOTIFICATION_RECIPIENTS).get()
  if (recipientsSnap.empty) return

  const candidateName = interviewData.candidateName as string
  const positionName = interviewData.positionName as string
  const message = `✅ *${candidateName}* (${positionName}) 면접관 전원이 가용 일정을 제출했습니다.\n일정 조율이 필요하시다면 담당자에게 문의 주시기 바랍니다.`

  await Promise.allSettled(
    recipientsSnap.docs.map((doc) =>
      slack.chat.postMessage({
        channel: doc.data().slackId as string,
        text: message,
      }),
    ),
  )
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
      const result = await handleViewSubmission(payload)
      return NextResponse.json(result ?? { response_action: 'clear' })
    }
  } catch (err) {
    // 슬랙은 200이 아니면 사용자에게 dispatch_failed를 표시하므로 항상 200 반환
    console.error('[slack/interactive] 처리 오류:', (err as Error).message)
  }

  return NextResponse.json({ ok: true })
}
