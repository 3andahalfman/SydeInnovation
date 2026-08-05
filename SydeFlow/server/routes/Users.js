const { supabase } = require('../supabase');

/**
 * Users table CRUD operations
 */
const Users = {
  /**
   * Create a new user
   * @param {string} email - User email
   * @param {string} passwordHash - Hashed password
   * @param {string} fullName - User full name
   * @param {string} role - 'admin' or 'user'
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  async create(email, passwordHash, fullName, role = 'user') {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role,
        is_active: true
      })
      .select()
      .single();
    return { data, error };
  },

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  async getByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    return { data, error };
  },

  /**
   * Get user by ID
   * @param {string} id - User UUID
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  /**
   * Update last login
   * @param {string} id - User UUID
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  async updateLastLogin(id) {
    const { data, error } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  /**
   * List all users
   * @returns {Promise<{data: Array, error: Error|null}>}
   */
  async getAll() {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  /**
   * Delete user
   * @param {string} id - User UUID
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  async delete(id) {
    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    return { data, error };
  }
};

module.exports = { Users };
