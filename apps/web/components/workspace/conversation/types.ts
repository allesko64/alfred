export interface ConversationMessage {
  id: string
  role: "alfred" | "user"
  content: string
  options?: string[] | null
}
