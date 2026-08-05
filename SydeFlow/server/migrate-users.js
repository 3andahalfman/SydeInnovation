const { supabase } = require('./supabase');

async function createUsersTable() {
  try {
    // Check if users table exists
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact' })
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('Users table needs to be created.');
        console.log('Run the following SQL in Supabase dashboard:');
        console.log('');
        console.log(`CREATE TABLE IF NOT EXISTS users (
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
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);
        process.exit(1);
      }
      throw error;
    }
    
    console.log('✓ Users table exists');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createUsersTable();
