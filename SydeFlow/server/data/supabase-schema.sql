-- SydeFlow Database Schema for Supabase
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql

-- ============================================
-- USERS TABLE
-- Stores authentication and user information
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',           -- 'admin' or 'user'
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PRODUCTS TABLE
-- Stores CAD models that can be configured
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Storage options
    local_path TEXT,                    -- Path to local file
    oss_bucket_key VARCHAR(255),        -- APS OSS bucket
    oss_object_key VARCHAR(255),        -- APS OSS object name
    oss_urn TEXT,                       -- APS URN for the object
    storage_type VARCHAR(20) DEFAULT 'local',  -- 'local' or 'oss'
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending_extraction',  -- pending_extraction, extracting, ready, error
    
    -- App Bundle info (for regeneration)
    app_bundle_id VARCHAR(255),
    activity_id VARCHAR(255),
    
    -- Metadata
    file_type VARCHAR(10),              -- 'ipt', 'iam'
    thumbnail_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PRODUCT PARAMETERS TABLE
-- Stores extracted parameters from CAD models
-- ============================================
CREATE TABLE IF NOT EXISTS product_parameters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- Parameter definition
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'number',   -- number, text, enum, boolean
    unit VARCHAR(50),                    -- mm, in, deg, etc.
    
    -- Value constraints
    default_value TEXT,
    min_value NUMERIC,
    max_value NUMERIC,
    options JSONB,                       -- For enum type: ["Option1", "Option2"]
    
    -- UI hints
    editable BOOLEAN DEFAULT true,
    display_name VARCHAR(255),
    description TEXT,
    display_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CONFIGURATIONS TABLE
-- Stores user-submitted parameter configurations
-- ============================================
CREATE TABLE IF NOT EXISTS configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- Configuration details
    name VARCHAR(255),
    parameters JSONB NOT NULL,           -- {"length": 500, "width": 300, ...}
    
    -- Job tracking
    status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
    work_item_id VARCHAR(255),           -- APS Design Automation work item ID
    error_message TEXT,
    
    -- Output info
    output_url TEXT,                     -- Direct URL or signed URL
    output_oss_key VARCHAR(255),         -- OSS object key for output
    output_file_name VARCHAR(255),       -- Original filename of output
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_product_parameters_product_id ON product_parameters(product_id);
CREATE INDEX IF NOT EXISTS idx_configurations_product_id ON configurations(product_id);
CREATE INDEX IF NOT EXISTS idx_configurations_status ON configurations(status);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at
    BEFORE UPDATE ON configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- Server uses service_role key (bypasses RLS).
-- Anon key has NO policies → direct PostgREST access blocked.
-- Authenticated role has full access for future Supabase Auth integration.
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_access_products" ON products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access_product_parameters" ON product_parameters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access_configurations" ON configurations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access_users" ON users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- INSERT INTO products (name, description, storage_type, status)
-- VALUES ('Custom Box', 'Configurable sheet metal box', 'local', 'ready');
