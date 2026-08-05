# 🚀 SydeFlow Authentication Setup - Visual Guide

## Quick Overview

You're almost there! Just 4 simple steps to get authentication working:

1. ✅ **Copy SQL** (already displayed above)
2. 🔄 **Run SQL in Supabase** (next)
3. ✨ **Create Admin User** (automatic)
4. 🎉 **Login & Test** (final)

---

## 📍 Step 1: Copy the SQL Code

The SQL code is already shown in the terminal above. You have two options:

### Option A: Copy from Terminal (Easiest)
- Highlight and copy the SQL code shown
- It's saved to: `server/data/000_create_users_table.sql`

### Option B: Copy from File
```bash
cat server/data/000_create_users_table.sql
```

---

## 🔄 Step 2: Run SQL in Supabase Dashboard

Follow these visual steps:

### 2.1 Open Supabase SQL Editor
```
👉 https://supabase.com/dashboard/project/fetlselitbzogponfcnh/sql/new
```

You should see a screen like this:

```
┌─────────────────────────────────────────────────────────────┐
│ Supabase Dashboard                                           │
├─────────────────────────────────────────────────────────────┤
│ Project: fetlselitbzogponfcnh                               │
│                                                               │
│  [SQL Editor]  [Query]  [Webhooks]                           │
│                                                               │
│  New Query [v] ┌─────────────────────────────────────────┐  │
│                │                                          │  │
│                │  (Paste SQL code here)                   │  │
│                │                                          │  │
│                │  ┌──────────────────────┐              │  │
│                │  │      Run [>]         │              │  │
│                │  └──────────────────────┘              │  │
│                │                                          │  │
│                └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Paste the SQL Code
1. Click in the SQL editor area
2. Paste the SQL code (Ctrl+V)

### 2.3 Click "Run" Button
- Click the blue **"Run"** button (or ▶ icon)
- Wait for the "Success" message

You should see:
```
✅ Query executed successfully
```

### 2.4 Verify the Table Was Created
Look for messages like:
```
CREATE TABLE - successfully
CREATE INDEX - successfully
CREATE FUNCTION - successfully
CREATE TRIGGER - successfully
```

---

## ✨ Step 3: Create Admin User (Automatic)

Once you see the success message in Supabase:

1. **Return to this terminal**
2. **Press ENTER**
3. The script will automatically:
   - ✅ Verify the table exists
   - ✅ Create the default admin account
   - ✅ Show you the login credentials

You'll see output like:
```
✅ Users table exists!
✅ Admin user created
   Email: admin@sydeflow.local
   Password: admin123
```

---

## 🎉 Step 4: Start Server & Login

### 4.1 Start the Server
Once Step 3 completes, run:

```bash
cd c:\Users\emera\SydeFlow
node server/start.js
```

Expected output:
```
Loading .env from: C:\Users\emera\SydeFlow\.env
[ProductsConfig] Routes loaded
Server is running on port 8080
✓ Supabase connected
```

### 4.2 Open Dashboard
In your browser, go to:
```
http://localhost:8080/admin
```

You should see the **Login Page** with:
- Email input field
- Password input field  
- "Sign In" button
- "Sign up" link

### 4.3 Login with Admin Account

**Option A: Login as Admin**
```
📧 Email:    admin@sydeflow.local
🔑 Password: admin123
```

**Option B: Create New Account**
- Click "Sign up"
- Enter your name, email, and password
- Click "Create Account"
- You'll be logged in automatically

---

## 🎯 What Happens Next

After successful login, you'll see:

```
┌──────────────────────────────────────────────────────────┐
│ SydeFlow Admin Console                                    │
├──────────────────────────────────────────────────────────┤
│                                                            │
│ Sidebar                    │ Dashboard Content             │
│ ─────────────              │ ────────────────              │
│ 📊 Dashboard               │ Welcome, Admin User!          │
│ 📦 Products                │                              │
│ 🎮 Configurator            │ [Quick Stats & Cards]        │
│ 💬 Quotes                  │                              │
│ 📊 Activity Log (admin)    │ ┌──────────────────────┐     │
│ ⚙️  Settings (admin)        │ │ [Various Dashboard] │     │
│ 📁 File Manager (admin)    │ │ [Widgets & Info]     │     │
│ 🔗 Integration (admin)     │ └──────────────────────┘     │
│                                                            │
│ [👤 Admin User ▼]                                        │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] SQL table created in Supabase (no errors)
- [ ] Admin user created with email `admin@sydeflow.local`
- [ ] Server starts without errors
- [ ] Can access `http://localhost:8080/admin`
- [ ] Login page displays
- [ ] Can login with admin credentials
- [ ] Dashboard loads after login
- [ ] Can see "Activity Log" and "Settings" items in sidebar (admin-only)

---

## 🆘 Troubleshooting

### Issue: "Could not find the table 'public.users'"
**Solution**: 
- Make sure you ran the SQL in Supabase
- Check the SQL executed with no errors
- Refresh the browser and try again

### Issue: "Invalid email or password" when logging in
**Solution**:
- Make sure you used exactly: `admin@sydeflow.local`
- Password is exactly: `admin123` (case-sensitive)
- Or create a new account via "Sign up"

### Issue: Server won't start
**Solution**:
- Make sure port 8080 is not in use
- Run: `netstat -ano | findstr :8080`
- If in use, kill the process: `Get-Process -Id <PID> | Stop-Process`

### Issue: Dashboard shows login page even after login
**Solution**:
- Clear browser cache: `Ctrl + Shift + Delete`
- Open in Incognito/Private mode
- Check browser console (F12) for errors

---

## 📞 What's Next?

Once you're logged in:

1. **Explore Features**
   - View Dashboard overview
   - Check Activity Log (admin only)
   - Configure Settings (admin only)

2. **Create Demo Data**
   - Add sample products
   - Create configurations
   - Test the configurator

3. **Invite Team Members**
   - Create user accounts
   - Set different roles
   - Test role-based access

4. **Customize**
   - Update branding
   - Change default settings
   - Add your company logo

---

## 🔒 Security Notes

- ✅ Passwords are hashed with bcrypt
- ✅ JWT tokens expire after 24 hours
- ✅ Tokens stored securely in localStorage
- ⚠️ For production: change `admin123` password
- ⚠️ For production: set strong `JWT_SECRET` in `.env`

---

**You're all set! 🎉 Follow the steps above to complete the setup.**

Need help? Check the `AUTHENTICATION.md` file for detailed documentation.
