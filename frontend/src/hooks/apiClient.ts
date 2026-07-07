import axios, { type InternalAxiosRequestConfig } from 'axios';

import type {
  AskResponse,
  ChatMessage,
  ChatSession,
  DocumentIngestResponse,
  DocumentSummary,
  FeedbackResponse,
} from '@/types/api';
import { appConfig } from '@/lib/config';
import { supabase } from '@/lib/supabase';

export const apiClient = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 120000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!supabase) {
    return config;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const fallback = 'The request could not be completed.';
      if (!error.response) {
        return Promise.reject(
          new Error(
            `Could not reach the backend at ${appConfig.apiBaseUrl}. Make sure FastAPI is running on port 8000, then refresh this page.`,
          ),
        );
      }

      const detail = error.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail
                .map((item) => item?.msg || item?.message || fallback)
                .join(' ')
            : error.message || fallback;

      return Promise.reject(new Error(message));
    }

    return Promise.reject(error instanceof Error ? error : new Error('Unexpected request error.'));
  },
);

export const api = {
  async uploadDocument(
    file: File,
    onUploadProgress?: (event: { loaded: number; total?: number }) => void,
  ): Promise<DocumentIngestResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<DocumentIngestResponse>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return data;
  },

  async listDocuments(): Promise<DocumentSummary[]> {
    const { data } = await apiClient.get<DocumentSummary[]>('/documents');
    return data;
  },

  async deleteDocument(documentName: string): Promise<void> {
    await apiClient.delete(`/documents/${encodeURIComponent(documentName)}`);
  },

  async listChats(): Promise<ChatSession[]> {
    const { data } = await apiClient.get<ChatSession[]>('/chats');
    return data;
  },

  async createChat(title: string): Promise<ChatSession> {
    const { data } = await apiClient.post<ChatSession>('/chats', { title });
    return data;
  },

  async deleteChat(sessionId: string): Promise<void> {
    await apiClient.delete(`/chats/${sessionId}`);
  },

  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data } = await apiClient.get<ChatMessage[]>(`/chats/${sessionId}/messages`);
    return data;
  },

  async askQuestion(sessionId: string, question: string): Promise<AskResponse> {
    const { data } = await apiClient.post<AskResponse>(`/chats/${sessionId}/ask`, { question });
    return data;
  },

  async sendFeedback(messageId: string, userFeedback: boolean): Promise<FeedbackResponse> {
    const { data } = await apiClient.patch<FeedbackResponse>(`/messages/${messageId}/feedback`, {
      user_feedback: userFeedback,
    });
    return data;
  },
};
