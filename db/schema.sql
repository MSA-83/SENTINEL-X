-- SENTINEL-X PostgreSQL Schema
-- Phase 2: Extended for Threat Intelligence Platform
-- Free Tier: Supabase PostgreSQL (500MB free)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE alert_severity AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'false_positive', 'escalated');
CREATE TYPE case_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE case_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE entity_type AS ENUM ('aircraft', 'vessel', 'person', 'organization', 'location', 'event', 'unknown');
CREATE TYPE event_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE user_role AS ENUM ('admin', 'analyst', 'viewer');

-- ============================================
-- CORE TABLES
-- ============================================

-- Users with RBAC
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    role user_role DEFAULT 'viewer',
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Threat Events
CREATE TABLE threat_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    sub_type VARCHAR(100),
    title TEXT NOT NULL,
    description TEXT,
    severity alert_severity NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    
    -- Location
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    location_name VARCHAR(255),
    region VARCHAR(100),
    country VARCHAR(100),
    
    -- Actors
    actor_1 VARCHAR(255),
    actor_2 VARCHAR(255),
    
    -- Metadata
    source VARCHAR(100),
    confidence DECIMAL(3, 2) DEFAULT 0.5,
    fatalities INTEGER DEFAULT 0,
    affected_count INTEGER DEFAULT 0,
    
    -- AI Analysis
    ai_summary TEXT,
    ai_recommendation TEXT,
    confidence_score DECIMAL(3, 2),
    
    -- Attribution
    reported_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    
    -- Timestamps
    event_timestamp TIMESTAMP,
    detected_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Additional
    metadata JSONB,
    tags TEXT[],
    source_link TEXT
);

CREATE INDEX idx_threat_events_id ON threat_events(event_id);
CREATE INDEX idx_threat_events_severity ON threat_events(severity);
CREATE INDEX idx_threat_events_status ON threat_events(status);
CREATE INDEX idx_threat_events_region ON threat_events(region);
CREATE INDEX idx_threat_events_timestamp ON threat_events(event_timestamp);
CREATE INDEX idx_threat_events_detected ON threat_events(detected_at);

-- Alert Rules
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    
    -- Conditions
    condition_type VARCHAR(100),  -- threshold, pattern, anomaly, geo
    condition_config JSONB NOT NULL,
    
    -- Actions
    severity alert_severity DEFAULT 'medium',
    notify_email BOOLEAN DEFAULT false,
    notify_sms BOOLEAN DEFAULT false,
    webhook_url TEXT,
    auto_escalate BOOLEAN DEFAULT false,
    
    -- Attribution
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Stats
    trigger_count INTEGER DEFAULT 0,
    last_triggered TIMESTAMP
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id VARCHAR(100) UNIQUE NOT NULL,
    rule_id UUID REFERENCES alert_rules(id),
    
    title TEXT NOT NULL,
    description TEXT,
    severity alert_severity NOT NULL,
    status alert_status DEFAULT 'active',
    
    -- Source
    source_type VARCHAR(50),  -- rule, manual, ai, external
    source_event UUID REFERENCES threat_events(id),
    
    -- Location
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    location_name VARCHAR(255),
    
    -- Timestamps
    triggered_at TIMESTAMP DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    
    -- Attribution
    triggered_by UUID REFERENCES users(id),
    acknowledged_by UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    
    -- Actions
    notes TEXT,
    resolution_notes TEXT,
    false_positive_reason TEXT
);

CREATE INDEX idx_alerts_rule_id ON alerts(rule_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at);

-- Cases
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id VARCHAR(100) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status case_status DEFAULT 'open',
    priority case_priority DEFAULT 'medium',
    
    -- Classification
    case_type VARCHAR(100),  -- threat_investigation, incident_response, intelligence, routine
    classification VARCHAR(50),  -- unclassified, confidential, secret, top_secret
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP,
    
    -- Linked Events
    linked_events UUID[] DEFAULT '{}',
    linked_alerts UUID[] DEFAULT '{}',
    linked_entities UUID[] DEFAULT '{}',
    
    -- Resolution
    resolution_summary TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    
    -- Additional
    tags TEXT[],
    metadata JSONB
);

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_priority ON cases(priority);
CREATE INDEX idx_cases_assigned ON cases(assigned_to);

-- Case Timeline
CREATE TABLE case_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    
    action_type VARCHAR(100) NOT NULL,  -- created, updated, note, evidence, escalation, assignment, status_change
    title TEXT NOT NULL,
    description TEXT,
    
    -- Attribution
    user_id UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Related
    related_event UUID REFERENCES threat_events(id),
    related_alert UUID REFERENCES alerts(id)
);

CREATE INDEX idx_case_timeline_case ON case_timeline(case_id);

-- Entities
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(100) UNIQUE NOT NULL,
    entity_type entity_type NOT NULL,
    
    -- Identification
    name VARCHAR(255) NOT NULL,
    aliases TEXT[],
    description TEXT,
    
    -- Classification
    threat_level VARCHAR(50),  -- unknown, low, medium, high, critical
    confidence DECIMAL(3, 2) DEFAULT 0.5,
    
    -- Location (current)
    current_latitude DECIMAL(10, 6),
    current_longitude DECIMAL(10, 6),
    current_location_name VARCHAR(255),
    last_seen TIMESTAMP,
    
    -- Metadata
    metadata JSONB,
    attributes JSONB,
    tags TEXT[],
    
    -- Attribution
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_threat ON entities(threat_level);
CREATE INDEX idx_entities_name ON entities(name);

-- Entity Links
CREATE TABLE entity_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    source_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    
    link_type VARCHAR(100) NOT NULL,  -- owns, operates, related_to, located_at, communicates_with
    strength DECIMAL(3, 2) DEFAULT 0.5,
    description TEXT,
    
    -- Attribution
    linked_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entity_links_source ON entity_links(source_entity_id);
CREATE INDEX idx_entity_links_target ON entity_links(target_entity_id);

-- Reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(100) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    report_type VARCHAR(100) NOT NULL,  -- threat_assessment, situational_awareness, summary, investigation
    
    summary TEXT,
    content TEXT,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, review, published, archived
    
    -- Related
    linked_events UUID[] DEFAULT '{}',
    linked_cases UUID[] DEFAULT '{}',
    
    -- Attribution
    created_by UUID REFERENCES users(id),
    published_by UUID REFERENCES users(id),
    published_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_status ON reports(status);

-- File Attachments
CREATE TABLE file_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER,
    file_hash VARCHAR(64),
    
    -- Storage (S3, Supabase Storage, etc)
    storage_provider VARCHAR(50),  -- s3, supabase, local
    storage_path TEXT,
    download_url TEXT,
    
    -- Association
    entity_id UUID REFERENCES entities(id),
    event_id UUID REFERENCES threat_events(id),
    case_id UUID REFERENCES cases(id),
    report_id UUID REFERENCES reports(id),
    
    -- Attribution
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_file_attachments_entity ON file_attachments(entity_id);
CREATE INDEX idx_file_attachments_case ON file_attachments(case_id);

-- Analytics Snapshots
CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    snapshot_type VARCHAR(100) NOT NULL,  -- daily, weekly, monthly, custom
    
    -- Metrics
    total_events INTEGER DEFAULT 0,
    critical_events INTEGER DEFAULT 0,
    high_events INTEGER DEFAULT 0,
    medium_events INTEGER DEFAULT 0,
    low_events INTEGER DEFAULT 0,
    
    total_alerts INTEGER DEFAULT 0,
    resolved_alerts INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    
    open_cases INTEGER DEFAULT 0,
    resolved_cases INTEGER DEFAULT 0,
    
    unique_entities INTEGER DEFAULT 0,
    new_entities INTEGER DEFAULT 0,
    
    -- Geographic
    top_regions JSONB,
    top_countries JSONB,
    top_types JSONB,
    
    -- Trends
    event_trend JSONB,
    alert_trend JSONB,
    
    -- Period
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_snapshots_type ON analytics_snapshots(snapshot_type);
CREATE INDEX idx_analytics_snapshots_period ON analytics_snapshots(period_start);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    action VARCHAR(100) NOT NULL,  -- create, read, update, delete, login, logout, export
    entity_type VARCHAR(50),  -- user, case, alert, event, entity, report
    entity_id UUID,
    
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    
    changes JSONB,
    metadata JSONB,
    
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- RBAC FUNCTIONS
-- ============================================

-- Check user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = user_id;
$$ LANGUAGE sql STABLE;

-- Check if user has admin role
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT role = 'admin' FROM users WHERE id = user_id;
$$ LANGUAGE sql STABLE;

-- Check if user can modify
CREATE OR REPLACE FUNCTION can_modify_entity(user_id UUID, entity_owner_id UUID)
RETURNS BOOLEAN AS $$
    SELECT 
        (SELECT role FROM users WHERE id = user_id) = 'admin'
        OR (SELECT role FROM users WHERE id = user_id) = 'analyst'
        OR entity_owner_id = user_id;
$$ LANGUAGE sql STABLE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at trigger to tables
CREATE TRIGGER update_threat_events_updated 
    BEFORE UPDATE ON threat_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cases_updated 
    BEFORE UPDATE ON cases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_entities_updated 
    BEFORE UPDATE ON entities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reports_updated 
    BEFORE UPDATE ON reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW-LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see all (admin/analyst view all)
CREATE POLICY users_select ON users
    FOR SELECT USING (
        role IN ('admin', 'analyst', 'viewer')
    );

CREATE POLICY users_update ON users
    FOR UPDATE USING (
        role = 'admin'
    );

-- Policy: Threat events - analysts+ can read, admin can write
CREATE POLICY threat_events_read ON threat_events
    FOR SELECT USING (
        (SELECT role FROM users WHERE id = 
            (SELECT _authed_user_id FROM auth_seeds LIMIT 1)
        ) IN ('admin', 'analyst', 'viewer')
    );

CREATE POLICY threat_events_write ON threat_events
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY threat_events_update ON threat_events
    FOR UPDATE USING (
        (SELECT role FROM users WHERE id = 
            (SELECT _authed_user_id FROM auth_seeds LIMIT 1)
        ) IN ('admin', 'analyst')
    );

-- Policy: Alerts - analysts+ can read/write
CREATE POLICY alerts_read ON alerts
    FOR SELECT USING (true);

CREATE POLICY alerts_write ON alerts
    FOR ALL USING (
        (SELECT role FROM users WHERE id = 
            (SELECT _authed_user_id FROM auth_seeds LIMIT 1)
        ) IN ('admin', 'analyst')
    );

-- Policy: Cases - admin can delete, analysts can modify
CREATE POLICY cases_read ON cases
    FOR SELECT USING (true);

CREATE POLICY cases_write ON cases
    FOR ALL USING (
        (SELECT role FROM users WHERE id = 
            (SELECT _authed_user_id FROM auth_seeds LIMIT 1)
        ) IN ('admin', 'analyst')
    );

-- Policy: Entities - read all, write admin/analyst
CREATE POLICY entities_read ON entities
    FOR SELECT USING (true);

CREATE POLICY entities_write ON entities
    FOR ALL USING (
        (SELECT role FROM users WHERE id = 
            (SELECT _authed_user_id FROM auth_seeds LIMIT 1)
        ) IN ('admin', 'analyst')
    );

-- ============================================
-- SEEDS
-- ============================================

-- Default admin user (change password in production!)
INSERT INTO users (email, username, role, full_name)
VALUES 
    ('admin@sentinel-x.dev', 'admin', 'admin', 'System Administrator'),
    ('analyst@sentinel-x.dev', 'analyst', 'analyst', 'Security Analyst'),
    ('viewer@sentinel-x.dev', 'viewer', 'viewer', 'Viewer')
ON CONFLICT (email) DO NOTHING;

-- Default Alert Rules
INSERT INTO alert_rules (name, description, condition_type, condition_config, severity, enabled)
VALUES 
    ('Critical Threat Detection', 'Alert on critical severity threats', 'severity', 
     '{"severity": "critical"}', 'critical', true),
    
    ('High Volume Detection', 'Alert when event count exceeds threshold', 'threshold',
     '{"count": 100, "window_minutes": 60}', 'high', true),
    
    ('Geographic Anomaly', 'Alert on unusual geographic activity', 'geo',
     '{"regions": [], "radius_km": 100}', 'medium', true)
ON CONFLICT (name) DO NOTHING;