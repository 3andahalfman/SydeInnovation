#!/usr/bin/env node

/**
 * Quick Setup Guide - Copy and paste the SQL below into Supabase
 * 
 * 1. Go to: https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql/new
 * 2. Paste the SQL code below
 * 3. Click "Run"
 * 4. Then run: node setup-auth.js
 */

const readline = require('readline');

const SQL_CODE = `-- Create users table with authentication support
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update the updated_at field
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();`;

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║        SydeFlow Authentication Setup - Quick Start             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('📋 Step 1: Create Users Table in Supabase\n');
console.log('1. Open Supabase SQL Editor:');
console.log('   👉 https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql/new\n');

console.log('2. Copy the SQL code below (it\'s already copied to clipboard):\n');
console.log('─'.repeat(65));
console.log(SQL_CODE);
console.log('─'.repeat(65));

console.log('\n3. Paste it into the SQL Editor');
console.log('4. Click the "Run" button\n');

console.log('📝 Step 2: Verify and Then Run This Script\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Have you created the users table in Supabase? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\n✓ Great! Now run: node setup-auth.js\n');
    process.exit(0);
  } else {
    console.log('\nℹ Please create the table first, then run this script again.\n');
    process.exit(0);
  }
  rl.close();
});

// Copy SQL to clipboard if possible
try {
  const clipboardy = require('clipboardy');
  clipboardy.writeSync(SQL_CODE);
  console.log('✂️  SQL code copied to clipboard!\n');
} catch (e) {
  // Clipboard not available, no problem
}
