CREATE EXTENSION IF NOT EXISTS vector;

-- Document Chunks Table with Hierarchical Structure
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_name TEXT NOT NULL,
    page_number INT NOT NULL,
    child_content TEXT NOT NULL,
    parent_content TEXT NOT NULL,
    embedding vector(384),
    text_search_vector tsvector,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for Hybrid Search Performance & Isolation
CREATE INDEX idx_chunks_user_vector ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_fts ON document_chunks USING gin(text_search_vector);
CREATE INDEX idx_chunks_user_id ON document_chunks(user_id);

-- Chat Session Container
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Ledger with Telemetry Loop
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    user_feedback BOOLEAN DEFAULT NULL, -- NULL = unrated, TRUE = thumbs up, FALSE = thumbs down
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies bound to auth.uid()
CREATE POLICY "Chunks Isolation" ON document_chunks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Sessions Isolation" ON chat_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Messages Isolation" ON messages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = messages.session_id AND chat_sessions.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = messages.session_id AND chat_sessions.user_id = auth.uid()));
