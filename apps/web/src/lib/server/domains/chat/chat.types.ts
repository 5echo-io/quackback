import type { ConversationId, PrincipalId } from '@quackback/ids'
import type { ChatMessageMetadata } from '@/lib/server/db'
import type {
  Channel,
  ChatAttachment,
  ChatMessageDTO,
  ConversationDTO,
} from '@/lib/shared/chat/types'

/** Author identity passed into a send call (resolved from the auth context). */
export interface ChatAuthorInput {
  principalId: PrincipalId
  displayName?: string | null
  avatarUrl?: string | null
  /** Email is used only by the offline-notification path, never rendered. */
  email?: string | null
}

/** Visitor send: omit conversationId to start a new conversation. */
export interface SendVisitorMessageInput {
  conversationId?: ConversationId
  content: string
  attachments?: ChatAttachment[]
  /** Optional pre-chat email; stored on the conversation if not already set. */
  visitorEmail?: string
  /** Channel provenance (e.g. inbound email message-id) persisted on the message. */
  metadata?: ChatMessageMetadata
  /** Channel a NEW conversation arrives on; ignored when appending. Defaults to
   *  'messenger' (the widget / portal live-chat surface). */
  channel?: Channel
  /** Subject for a NEW conversation (e.g. an inbound email's Subject); ignored
   *  when appending. Defaults to a preview of the first message. */
  subject?: string
}

export interface SendVisitorMessageResult {
  conversation: ConversationDTO
  message: ChatMessageDTO
  /** True when this send created the conversation (first message). */
  created: boolean
}

export interface SendAgentMessageResult {
  conversation: ConversationDTO
  message: ChatMessageDTO
}
