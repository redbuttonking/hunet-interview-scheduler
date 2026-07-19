// 인터뷰 취소 알림의 시스템 수신자 Slack 대상을 구성하는 함수
type SystemUser = {
  name: string
  email: string
  role: 'admin' | 'recruiter' | 'viewer'
}

type SlackUser = {
  id: string
  email?: string
}

interface Input {
  interviewerSlackIds: string[]
  notificationSlackIds: string[]
  systemUsers: SystemUser[]
  slackUsers: SlackUser[]
}

export function resolveCancellationRecipients({
  interviewerSlackIds,
  notificationSlackIds,
  systemUsers,
  slackUsers,
}: Input): { slackIds: string[]; unmatchedSystemUserNames: string[] } {
  const slackIdByEmail = new Map(
    slackUsers
      .filter((user) => user.email)
      .map((user) => [user.email!.toLowerCase(), user.id]),
  )
  const eligibleUsers = systemUsers.filter((user) => user.role === 'admin' || user.role === 'recruiter')
  const systemSlackIds: string[] = []
  const unmatchedSystemUserNames: string[] = []

  eligibleUsers.forEach((user) => {
    const slackId = slackIdByEmail.get(user.email.toLowerCase())
    if (slackId) systemSlackIds.push(slackId)
    else unmatchedSystemUserNames.push(user.name)
  })

  return {
    slackIds: [...new Set([...interviewerSlackIds, ...notificationSlackIds, ...systemSlackIds])],
    unmatchedSystemUserNames,
  }
}
