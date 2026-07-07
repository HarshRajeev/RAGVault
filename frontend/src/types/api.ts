export type MessageRole = 'user' | 'assistant';

export interface DocumentIngestResponse {
  document_name: string;
  pages_processed: number;
  parent_chunks: number;
  child_chunks: number;
}

export interface DocumentSummary {
  document_name: string;
  pages: number;
  chunks: number;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface Citation {
  source?: number;
  chunk_id?: string;
  document_name: string;
  page_number: number;
  score?: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  user_feedback: boolean | null;
  created_at: string;
  isPending?: boolean;
}

export interface AskResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  rewritten_query: string;
  rate_limited: boolean;
}

export interface FeedbackResponse {
  message_id: string;
  user_feedback: boolean;
}
