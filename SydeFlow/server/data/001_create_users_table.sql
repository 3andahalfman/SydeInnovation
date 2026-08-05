/**
 * Create Users Table in Supabase
 * Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql
 */

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
    'admin@sydeflow.local',
    '$2b$10$VfZwj6.w7Zy6MzQhqF0rve6rH8byhKBmE6z2y8fEqNGkzKYSfxlte',
    'System Administrator',
    'admin',
    true
)
ON CONFLICT (email) DO NOTHING;
