// Slack 워크스페이스의 사용자와 채널 목록을 조회하는 서비스
import { WebClient } from '@slack/web-api'

export interface SlackDirectoryChannel {
  id: string
  name: string
  isPrivate: boolean
  isMember: boolean
  numMembers?: number
}

export interface SlackDirectoryUser {
  id: string
  name: string
  realName: string
  displayName: string
  email?: string
  isRestricted: boolean
  isUltraRestricted: boolean
}

interface RawSlackChannel {
  id?: string
  name?: string
  is_private?: boolean
  is_member?: boolean
  num_members?: number
}

interface RawSlackUser {
  id?: string
  name?: string
  real_name?: string
  deleted?: boolean
  is_bot?: boolean
  is_app_user?: boolean
  is_restricted?: boolean
  is_ultra_restricted?: boolean
  profile?: {
    display_name?: string
    real_name?: string
    email?: string
  }
}

export function formatSlackChannel(channel: RawSlackChannel): SlackDirectoryChannel | null {
  if (!channel.id || !channel.name) return null

  return {
    id: channel.id,
    name: channel.name,
    isPrivate: channel.is_private ?? false,
    isMember: channel.is_member ?? false,
    numMembers: channel.num_members,
  }
}

export function formatSlackUser(user: RawSlackUser): SlackDirectoryUser | null {
  if (!user.id || user.deleted || user.is_bot || user.is_app_user) return null

  const realName = user.profile?.real_name || user.real_name || user.name || ''
  const displayName = user.profile?.display_name || realName

  return {
    id: user.id,
    name: user.name ?? '',
    realName,
    displayName,
    email: user.profile?.email,
    isRestricted: user.is_restricted ?? false,
    isUltraRestricted: user.is_ultra_restricted ?? false,
  }
}

export class SlackDirectoryService {
  private readonly client: WebClient

  constructor(token = process.env.SLACK_BOT_TOKEN) {
    if (!token) throw new Error('SLACK_BOT_TOKEN이 설정되어 있지 않습니다.')
    this.client = new WebClient(token)
  }

  async listChannels(): Promise<SlackDirectoryChannel[]> {
    const channels: SlackDirectoryChannel[] = []
    let cursor: string | undefined

    do {
      const response = await this.client.conversations.list({
        cursor,
        exclude_archived: true,
        limit: 200,
        types: 'public_channel,private_channel',
      })

      const pageChannels = ((response.channels ?? []) as RawSlackChannel[])
        .map(formatSlackChannel)
        .filter((channel): channel is SlackDirectoryChannel => channel !== null)

      channels.push(...pageChannels)
      cursor = response.response_metadata?.next_cursor || undefined
    } while (cursor)

    return channels.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }

  async listUsers(): Promise<SlackDirectoryUser[]> {
    const users: SlackDirectoryUser[] = []
    let cursor: string | undefined

    do {
      const response = await this.client.users.list({
        cursor,
        limit: 200,
      })

      const pageUsers = ((response.members ?? []) as RawSlackUser[])
        .map(formatSlackUser)
        .filter((user): user is SlackDirectoryUser => user !== null)

      users.push(...pageUsers)
      cursor = response.response_metadata?.next_cursor || undefined
    } while (cursor)

    return users.sort((a, b) => a.realName.localeCompare(b.realName, 'ko'))
  }
}
