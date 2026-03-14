-- Knowledge Graph: base tables + document management upgrade
-- Run in Supabase SQL Editor

-- 0. Base KG tables (if not exist)
CREATE TABLE IF NOT EXISTS kg_nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL,
  label TEXT NOT NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id SERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON kg_edges(edge_type);

-- 1. Documents table
CREATE TABLE IF NOT EXISTS kg_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  source_type TEXT NOT NULL DEFAULT 'text',
  source_url TEXT,
  file_size INTEGER DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE,
  entity_count INTEGER DEFAULT 0,
  relation_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_kg_documents_processed ON kg_documents(processed);
CREATE INDEX IF NOT EXISTS idx_kg_documents_uploaded ON kg_documents(uploaded_at DESC);

-- 2. Extend kg_nodes
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'auto';

CREATE INDEX IF NOT EXISTS idx_kg_nodes_document ON kg_nodes(document_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_source ON kg_nodes(source);

-- 3. Extend kg_edges
ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_kg_edges_document ON kg_edges(document_id);

-- 4. Document-entity junction table
CREATE TABLE IF NOT EXISTS kg_document_entities (
  document_id UUID NOT NULL REFERENCES kg_documents(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  mention_count INTEGER DEFAULT 1,
  context TEXT,
  PRIMARY KEY (document_id, entity_id)
);

-- 5. QA history table
CREATE TABLE IF NOT EXISTS kg_qa_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  confidence FLOAT,
  feedback INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_qa_history_created ON kg_qa_history(created_at DESC);

-- 6. RLS policies
ALTER TABLE kg_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_document_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_qa_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'kg_documents_all') THEN
    EXECUTE 'CREATE POLICY kg_documents_all ON kg_documents FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'kg_document_entities_all') THEN
    EXECUTE 'CREATE POLICY kg_document_entities_all ON kg_document_entities FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'kg_qa_history_all') THEN
    EXECUTE 'CREATE POLICY kg_qa_history_all ON kg_qa_history FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END
$$;
