const { supabase } = require('../supabase');

/**
 * Users table CRUD operations (profile / RBAC layer on top of Supabase Auth)
 */
const Users = {
  async create(email, passwordHash, fullName, role = 'user', id = null) {
    const row = {
      email,
      password_hash: passwordHash || 'supabase-auth-managed',
      full_name: fullName,
      role,
      is_active: true,
      failed_login_count: 0,
      locked_until: null,
    };
    if (id) {
      row.id = id;
      row.auth_user_id = id;
    }
    const { data, error } = await supabase
      .from('users')
      .insert(row)
      .select()
      .single();
    return { data, error };
  },

  async upsertProfile({ id, email, fullName, role = 'user' }) {
    const payload = {
      id,
      auth_user_id: id,
      email,
      full_name: fullName || email.split('@')[0],
      role,
      password_hash: 'supabase-auth-managed',
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    // Prefer match by auth id; fall back to email update
    const byId = await this.getById(id);
    if (byId.data) {
      const { data, error } = await supabase
        .from('users')
        .update({
          email,
          full_name: payload.full_name,
          role,
          auth_user_id: id,
          is_active: true,
          updated_at: payload.updated_at,
        })
        .eq('id', id)
        .select()
        .single();
      return { data, error };
    }

    const byEmail = await this.getByEmail(email);
    if (byEmail.data) {
      const { data, error } = await supabase
        .from('users')
        .update({
          full_name: payload.full_name,
          role,
          auth_user_id: id,
          is_active: true,
          updated_at: payload.updated_at,
        })
        .eq('email', email)
        .select()
        .single();
      return { data, error };
    }

    return this.create(email, 'supabase-auth-managed', payload.full_name, role, id);
  },

  async getByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    return { data, error };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  },

  async getByAuthUserId(authUserId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    return { data, error };
  },

  async updateLastLogin(id) {
    const { data, error } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async getAll() {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, created_at, locked_until, failed_login_count')
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  async delete(id) {
    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    return { data, error };
  },
};

module.exports = { Users };
