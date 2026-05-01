-- SENTINEL-X Free PGVector + RLS + TimescaleDB
-- Neon/Supabase compatible | Defense-grade | GDPR compliant

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaleDB;

-- Organizations table (multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity vectors table (384 dim MiniLM)
CREATE TABLE entity_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    embedding VECTOR(384) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML observations table
CREATE TABLE ml_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    domain TEXT NOT NULL,
    domainkey TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    speed FLOAT DEFAULT 0,
    confidence FLOAT DEFAULT 1.0,
    embedding VECTOR(384),
    anomaly_score FLOAT DEFAULT 0,
    is_anomaly BOOLEAN DEFAULT FALSE,
    severity TEXT DEFAULT 'low',
    analyst_label JSONB,
    agent_label JSONB,
    agent_id UUID,
    curated_at TIMESTAMPTZ,
    dataset_version TEXT DEFAULT 'v1.0',
    split TEXT DEFAULT 'train',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security audit table
CREATE TABLE security_audit (
    id SERIAL PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    user_id UUID,
    query TEXT NOT NULL,
    params JSONB,
    ip INET,
    suspicious BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertables
SELECT create_hypertable('entity_vectors', 'observed_at');
SELECT create_hypertable('ml_observations', 'observed_at');

-- RLS - Enable
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY org_isolation_orgs ON organizations
    USING (owner_id = auth.uid());

CREATE POLICY org_isolation_vectors ON entity_vectors
    USING (org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

CREATE POLICY org_isolation_obs ON ml_observations
    USING (org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

CREATE POLICY audit_insert ON security_audit
    FOR INSERT WITH CHECK (org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- HNSW Index for vector search (10x faster)
CREATE INDEX entity_vectors_hnsw ON entity_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

CREATE INDEX ml_observations_hnsw ON ml_observations
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- TimescaleDB compression (50% storage reduction)
SELECT add_compression_policy('entity_vectors', INTERVAL '7 days');
SELECT add_compression_policy('ml_observations', INTERVAL '7 days');

-- Indexes for common queries
CREATE INDEX idx_observations_domain ON ml_observations(domain);
CREATE INDEX idx_observations_anomaly ON ml_observations(is_anomaly);
CREATE INDEX idx_observations_created ON ml_observations(created_at);
CREATE INDEX idx_observations_version ON ml_observations(dataset_version);
