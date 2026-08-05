/**
 * Complete Authentication Setup Script
 * Runs all necessary SQL migrations and creates default admin user
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://fetlselitbzogponfcnh.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldGxzZWxpdGJ6b2dwb25mY25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTQ1NTEsImV4cCI6MjA4NDU5MDU1MX0.WfBNcsOMhT3TtD_zsvC9uDQNXCCifF4qMoJmZUCQiF4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAuthentication() {
  console.log('🔐 SydeFlow Authentication Setup');
  console.log('================================\n');

  try {
    // Step 1: Check if users table exists
    console.log('Step 1: Checking if users table exists...');
    const { data: tableCheck, error: checkError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (tableCheck !== null) {
      console.log('✓ Users table already exists\n');
    } else if (checkError && checkError.message.includes('does not exist')) {
      console.log('⚠ Users table does not exist. Creating...\n');
      
      // Create users table using raw SQL via rpc would be needed
      // Since we can't execute raw SQL directly, inform user
      console.log('❌ Cannot create table via API. Please run the following SQL in Supabase SQL Editor:\n');
      
      const sql = `
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

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
      `;
      
      console.log(sql);
      console.log('\nVisit: https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql/new');
      process.exit(1);
    }

    // Step 2: Check if default admin user exists
    console.log('Step 2: Checking for default admin user...');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@sydeflow.local')
      .single();

    if (adminUser) {
      console.log('✓ Admin user already exists');
      console.log(`  Email: ${adminUser.email}`);
      console.log(`  Role: ${adminUser.role}`);
      console.log(`  Active: ${adminUser.is_active}\n`);
    } else {
      console.log('⚠ Admin user not found. Creating...');
      
      // Hash password for admin user (password: admin123)
      const passwordHash = await bcrypt.hash('admin123', 10);
      
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          email: 'admin@sydeflow.local',
          password_hash: passwordHash,
          full_name: 'System Administrator',
          role: 'admin',
          is_active: true
        })
        .select()
        .single();

      if (createError && !createError.message.includes('duplicate')) {
        throw createError;
      }

      if (newAdmin) {
        console.log('✓ Admin user created successfully');
        console.log(`  Email: ${newAdmin.email}`);
        console.log(`  Password: admin123`);
        console.log(`  Role: ${newAdmin.role}\n`);
      } else {
        console.log('✓ Admin user already exists (created by another process)\n');
      }
    }

    // Step 3: Test authentication
    console.log('Step 3: Testing authentication system...');
    
    // Test: Try to get the admin user
    const { data: testUser, error: testError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', 'admin@sydeflow.local')
      .single();

    if (testUser) {
      console.log('✓ Successfully queried admin user from database\n');
    } else {
      throw new Error('Could not query admin user');
    }

    // Step 4: Summary
    console.log('✅ Authentication Setup Complete!\n');
    console.log('Next Steps:');
    console.log('1. Start the server: node server/start.js');
    console.log('2. Visit: http://localhost:8080/admin');
    console.log('3. Login with:');
    console.log('   Email: admin@sydeflow.local');
    console.log('   Password: admin123');
    console.log('4. Or create a new account by signing up\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
}

setupAuthentication();
