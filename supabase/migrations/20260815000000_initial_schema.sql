-- Supabase Schema Initialization for Power BI-Style Analytics Dashboard

-- 1. Datasets Table (Represents a workspace / uploaded file context)
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Data Tables (Metadata about dynamically created tables for sheets)
CREATE TABLE IF NOT EXISTS data_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    table_name TEXT NOT NULL UNIQUE,
    columns JSONB NOT NULL, -- Format: [{ name: string, type: string, isPrimary: boolean }]
    row_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Relationships (Maps foreign keys between tables dynamically)
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    from_table UUID REFERENCES data_tables(id) ON DELETE CASCADE,
    from_column TEXT NOT NULL,
    to_table UUID REFERENCES data_tables(id) ON DELETE CASCADE,
    to_column TEXT NOT NULL,
    relationship_type TEXT NOT NULL, -- e.g., 'many_to_one', 'one_to_one'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Import Logs (Audit trail for data ingestion and deduplication)
CREATE TABLE IF NOT EXISTS import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    data_table_id UUID REFERENCES data_tables(id) ON DELETE CASCADE,
    rows_added INTEGER DEFAULT 0,
    rows_updated INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- 'success', 'partial', 'error'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Enable RLS (Row Level Security) if multi-tenant is enabled in the future.
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access for local development/single-tenant internal use
CREATE POLICY "Public full access datasets" ON datasets FOR ALL USING (true);
CREATE POLICY "Public full access data_tables" ON data_tables FOR ALL USING (true);
CREATE POLICY "Public full access relationships" ON relationships FOR ALL USING (true);
CREATE POLICY "Public full access import_logs" ON import_logs FOR ALL USING (true);
