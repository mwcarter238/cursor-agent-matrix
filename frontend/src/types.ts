export interface CursorAgent {
  id: string
  name?: string
  status?: string
  summary?: string
  source?: { repository?: string; ref?: string }
  target?: {
    branchName?: string
    prUrl?: string
    url?: string
    autoCreatePr?: boolean
  }
  createdAt?: string
}

export interface AgentsListResponse {
  agents: CursorAgent[]
  nextCursor?: string
}

export interface ConversationResponse {
  id: string
  messages?: Array<{ id?: string; type?: string; text?: string }>
}
