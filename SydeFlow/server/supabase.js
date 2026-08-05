const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
    console.error('FATAL: SUPABASE_URL not configured in environment');
    process.exit(1);
}

// Use service_role key (bypasses RLS) for server-side operations.
const supabaseKey = process.env.service_role_key
    || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('FATAL: Supabase service_role_key not configured in environment.');
    console.error('Set service_role_key or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase, supabaseUrl };
