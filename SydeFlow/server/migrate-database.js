#!/usr/bin/env node

/**
 * Database Migration Script
 * Creates users table in Supabase if it doesn't exist
 */

const { supabase } = require('./supabase');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔄 Starting database migration...\n');

  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'data', 'supabase-schema.sql');
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the SQL using Supabase RPC
    // For now, we'll manually execute critical table creation

    console.log('📋 Checking if users table exists...');
    
    const { data: existingTable, error: checkError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Users table already exists!');
      process.exit(0);
    }

    // Table doesn't exist, execute the schema
    console.log('⚙️  Creating users table...');
    
    const createUserTable = `
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
    `;

    // Execute via Supabase functions or direct SQL
    // Since Supabase client doesn't directly support raw SQL,
    // we'll provide instructions for manual execution
    
    console.log('\n❌ Cannot execute DDL via Supabase client');
    console.log('\n📝 To create the users table, run this SQL in Supabase:');
    console.log('\n---');
    console.log(createUserTable);
    console.log('---\n');
    
    console.log('🔗 Steps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql');
    console.log('2. Click "New Query"');
    console.log('3. Paste the SQL above');
    console.log('4. Click "Run"');
    console.log('5. Then restart the server\n');

    process.exit(1);

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

runMigration();
