# SydeFlow Authentication Setup

## Overview

SydeFlow now includes a complete authentication system with JWT tokens and role-based access control (RBAC). Users can sign up, log in, and access different features based on their role (admin or user).

## Features

- **User Registration**: New users can create accounts via signup
- **User Login**: Existing users can log in with JWT tokens
- **JWT Authentication**: Secure token-based session management
- **Role-Based Access Control**: Separate admin and user roles
  - **Admin users**: Full access to all features including Activity Log, Settings, File Manager, and Integration
  - **Regular users**: Access to Product configurations, Quotes, and Configurator only
- **Persistent Sessions**: Tokens stored in localStorage for persistent sessions

## Getting Started

### Step 1: Create the Users Table in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/fetlselitbzogponfcnh
2. Navigate to the **SQL Editor**
3. Create a **new query** and paste the contents of `server/data/001_create_users_table.sql`
4. Click **Run** to execute the migration

This will:
- Create the `users` table with required fields
- Create indexes for fast lookups
- Create a trigger for automatic `updated_at` timestamps
- Insert a default admin user with credentials:
  - **Email**: `admin@sydeflow.local`
  - **Password**: `admin123`

### Step 2: Access the Dashboard

1. Navigate to `http://localhost:8080/admin` in your browser
2. You should see the login page

### Step 3: Test the Authentication

#### Option 1: Login as Admin
- Email: `admin@sydeflow.local`
- Password: `admin123`

#### Option 2: Create a New User Account
1. Click "Sign up" on the login page
2. Enter your email, name, and a password (minimum 6 characters)
3. Click "Create Account"
4. You'll be automatically logged in and redirected to the dashboard

## API Endpoints

### Authentication Routes (`/api/auth`)

```bash
# Signup
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Get Current User (requires token)
GET /api/auth/me
Headers: Authorization: Bearer <token>

# Verify Token
POST /api/auth/verify-token
{
  "token": "<jwt_token>"
}

# Logout
POST /api/auth/logout
Headers: Authorization: Bearer <token>
```

## Role-Based Access

### Admin-Only Features
- **Activity Log** - View system activity and events
- **Settings** - Configure APS credentials and system settings
- **File Manager** - Browse and manage OSS storage
- **Integration** - API keys and webhooks configuration

### User-Accessible Features
- **Dashboard** - Overview and quick stats
- **Products** - View product catalog
- **Configurator** - Configure and preview products
- **Quotes** - Submit and track quote requests

## How It Works

### Frontend (Admin Console)

1. **LoginView Component** (`src/components/views/LoginView.tsx`)
   - Displays login/signup forms
   - Handles user authentication
   - Stores JWT token and user data in localStorage

2. **Page Component** (`src/app/page.tsx`)
   - Checks authentication on app load
   - Redirects unauthenticated users to login page
   - Restricts admin-only views based on user role
   - Displays user profile menu with logout option

3. **Sidebar Component** (`src/components/Sidebar.tsx`)
   - Filters navigation items based on user role
   - Hides admin-only menu items for regular users

### Backend (Express API)

1. **Auth Routes** (`server/routes/Auth.js`)
   - POST `/signup` - Create new user account
   - POST `/login` - Authenticate and return JWT token
   - GET `/me` - Get current user profile (protected)
   - POST `/verify-token` - Validate JWT token
   - POST `/logout` - Logout user

2. **Auth Middleware** (`server/middleware/auth.js`)
   - `authenticate` - Verify JWT token from Authorization header or cookies
   - `requireAdmin` - Check if user has admin role
   - `generateToken` - Create JWT token
   - `verifyToken` - Validate and decode JWT

3. **Users Route** (`server/routes/Users.js`)
   - CRUD operations for user management
   - Database queries via Supabase client

## Protecting Routes

To protect additional routes with authentication, add the middleware:

```javascript
const { authenticate, requireAdmin } = require('../middleware/auth');

// Require authentication only
router.get('/protected', authenticate, (req, res) => {
  // req.user contains { id, email, role }
});

// Require authentication AND admin role
router.post('/admin-only', authenticate, requireAdmin, (req, res) => {
  // Only admins can access
});
```

## Environment Variables

The following environment variables are used:

```env
JWT_SECRET=your-secret-key-change-in-production
SUPABASE_URL=https://fetlselitbzogponfcnh.supabase.co  
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Security Considerations

1. **Password Hashing**: Passwords are hashed using bcrypt with 10 salt rounds
2. **JWT Secret**: Change `JWT_SECRET` in `.env` for production
3. **Token Expiration**: Tokens expire after 24 hours
4. **HTTPS**: Use HTTPS in production (not localhost)
5. **CORS**: Configured for localhost development

## Troubleshooting

### Login not working
- Ensure the `users` table exists in Supabase by running the migration SQL
- Check browser console for error messages
- Verify `JWT_SECRET` is set in `.env`

### "Cannot find module" errors
- Run `npm install` in the server directory
- Verify all dependencies are installed

### User stuck on login page
- Clear browser localStorage: `localStorage.clear()`
- Check if token has expired (24-hour expiration)
- Verify user account exists in Supabase

## Next Steps

1. Create additional admin users for your team
2. Customize the sidebar and views for your business needs
3. Add more roles (e.g., 'viewer', 'editor') as needed
4. Implement password reset functionality
5. Add two-factor authentication (2FA)

---

For questions or issues, check the server logs and browser console for detailed error messages.
