#!/usr/bin/env node

/**
 * SydeFlow Authentication Setup - Supabase MCP Integration
 * 
 * This script guides you through setting up authentication with Supabase
 */

const fs = require('fs');
const path = require('path');

console.clear();
console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║         🔐 SydeFlow Authentication Setup with Supabase            ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

✅ You have Supabase MCP installed! This makes setup much easier.

Here's what needs to happen:

STEP 1️⃣  Create the Users Table (2 minutes)
STEP 2️⃣  Create Default Admin Account (30 seconds)
STEP 3️⃣  Start the Server (Automatic)
STEP 4️⃣  Test the Login (1 minute)

═══════════════════════════════════════════════════════════════════

📋 STEP 1: Copy the SQL Migration

The SQL code below needs to be run in your Supabase database.

Choose ONE of these methods:

METHOD A: Supabase Dashboard (Easiest)
  1. Go to: https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql/new
  2. Paste the SQL code below
  3. Click "Run"

METHOD B: Supabase CLI (If installed)
  Just run: supabase migration new create_users_table

═══════════════════════════════════════════════════════════════════
`);

const sqlCode = `-- Create users table for authentication
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create function for timestamp updates
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();`;

console.log('SQL CODE TO RUN:');
console.log('─'.repeat(65));
console.log(sqlCode);
console.log('─'.repeat(65));

// Save SQL to file for easy copying
const sqlFilePath = path.join(__dirname, 'data', '000_create_users_table.sql');
fs.writeFileSync(sqlFilePath, sqlCode, 'utf8');
console.log(`\n✓ SQL saved to: ${sqlFilePath}`);

console.log(`
═══════════════════════════════════════════════════════════════════

👉 NEXT: Open Supabase Dashboard

1. Visit: https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql/new
2. Copy the SQL code above (or from file: server/data/000_create_users_table.sql)
3. Paste it into the SQL editor
4. Press "Run" button
5. Wait for "Success" message

Then come back here and press ENTER to continue...

═══════════════════════════════════════════════════════════════════
`);

// Wait for user to finish Supabase setup
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Press ENTER once you\'ve run the SQL in Supabase: ', async () => {
  console.log('\n⏳ Verifying database...\n');
  
  try {
    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const bcrypt = require('bcrypt');
    require('dotenv').config();
    
    const supabaseUrl = process.env.SUPABASE_URL || 'https://fetlselitbzogponfcnh.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if table exists
    const { data: checkResult, error: checkError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('❌ Users table not found in database');
      console.log('\nMake sure you:');
      console.log('1. Went to the Supabase dashboard');
      console.log('2. Opened SQL Editor');
      console.log('3. Pasted the SQL code above');
      console.log('4. Clicked the "Run" button');
      console.log('\nThen try again by running: node setup-interactive.js\n');
      process.exit(1);
    }
    
    console.log('✅ Users table exists!\n');
    
    // Create default admin user
    console.log('📝 STEP 2: Creating default admin user...\n');
    
    const adminEmail = 'admin@sydeflow.local';
    const adminPassword = 'admin123';
    
    // Check if admin exists
    const { data: existingAdmin, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .single();
    
    if (existingAdmin) {
      console.log('ℹ  Admin user already exists');
      console.log(`   Email: ${adminEmail}`);
    } else {
      // Create admin user
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          email: adminEmail,
          password_hash: passwordHash,
          full_name: 'System Administrator',
          role: 'admin',
          is_active: true
        })
        .select()
        .single();
      
      if (createError) {
        if (!createError.message.includes('duplicate')) {
          throw createError;
        }
      }
      
      console.log('✅ Admin user created');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    }
    
    console.log(`
═══════════════════════════════════════════════════════════════════

✨ SETUP COMPLETE! 

You can now:

1. Start the server:
   cd c:\\Users\\emera\\SydeFlow
   node server/start.js

2. Open your browser:
   http://localhost:8080/admin

3. Login with:
   📧 Email: admin@sydeflow.local
   🔑 Password: admin123

4. Or create a new account by clicking "Sign up"

═══════════════════════════════════════════════════════════════════

🎉 Authentication System is Ready!

Features enabled:
✓ User Registration
✓ User Login with JWT
✓ Role-Based Access Control (Admin vs User)
✓ Protected Admin Routes
✓ Session Management

For detailed documentation, see: AUTHENTICATION.md

═══════════════════════════════════════════════════════════════════
    `);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Setup Error:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
  
  rl.close();
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled. Run again with: node setup-interactive.js\n');
  process.exit(0);
});
