# Calendar Integration Setup Guide

## 1. Microsoft Outlook/Office 365 Setup

### Step 1: Register an App in Azure Portal
1. Go to https://portal.azure.com
2. Sign in with your Microsoft account
3. Click on **"Azure Active Directory"** in the left menu (or search for it)
4. Click **"App registrations"** in the left sidebar
5. Click **"+ New registration"** button at the top

### Step 2: Configure Your App
1. **Name**: Enter "Jason Calendar Integration" (or any name you prefer)
2. **Supported account types**: Choose one:
   - "Accounts in this organizational directory only" (for company use)
   - "Accounts in any organizational directory" (for multi-tenant)
   - "Accounts in any organizational directory and personal Microsoft accounts" (recommended)
3. **Redirect URI**: 
   - Select "Web" from dropdown
   - Enter: `https://localhost:3001/api/auth/callback/microsoft`
4. Click **"Register"**

### Step 3: Get Your Credentials
After registration, you'll see the app overview page:
- **Client ID**: Copy the "Application (client) ID" shown on this page
- **Tenant ID**: Copy the "Directory (tenant) ID" (or use "common" for multi-tenant)

### Step 4: Create Client Secret
1. In the left menu, click **"Certificates & secrets"**
2. Click **"+ New client secret"**
3. Add a description (e.g., "Jason Dev Secret")
4. Choose expiration (6 months, 1 year, 2 years, or never)
5. Click **"Add"**
6. **IMPORTANT**: Copy the secret VALUE immediately (not the ID) - you can't see it again!

### Step 5: Add API Permissions
1. In the left menu, click **"API permissions"**
2. Click **"+ Add a permission"**
3. Choose **"Microsoft Graph"**
4. Choose **"Delegated permissions"**
5. Search and add these permissions:
   - `Calendars.Read`
   - `Calendars.ReadWrite`
   - `User.Read`
   - `offline_access` (for refresh tokens)
6. Click **"Add permissions"**
7. Click **"Grant admin consent"** if you're an admin

### Your Microsoft Credentials:
```
MICROSOFT_CLIENT_ID=<Application (client) ID from Step 3>
MICROSOFT_CLIENT_SECRET=<Secret VALUE from Step 4>
MICROSOFT_TENANT_ID=<Directory (tenant) ID from Step 3, or use "common">
```

---

## 2. Google Calendar Setup

### Step 1: Create a Project in Google Cloud Console
1. Go to https://console.cloud.google.com
2. Sign in with your Google account
3. Click the project dropdown at the top
4. Click **"New Project"**
5. Enter project name: "Jason Calendar Integration"
6. Click **"Create"**

### Step 2: Enable Google Calendar API
1. Make sure your new project is selected
2. Go to https://console.cloud.google.com/apis/library
3. Search for **"Google Calendar API"**
4. Click on it and click **"Enable"**

### Step 3: Create OAuth2 Credentials
1. Go to https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Choose **"OAuth client ID"**
4. If prompted, configure consent screen first:
   - Choose "External" (unless you have Google Workspace)
   - Fill in required fields:
     - App name: "Jason Calendar Integration"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: Search and add:
     - `../auth/calendar`
     - `../auth/calendar.events`
   - Add test users: Add your email
   - Save and continue

### Step 4: Create OAuth Client
1. Back at Create OAuth client ID:
   - **Application type**: "Web application"
   - **Name**: "Jason Web Client"
   - **Authorized redirect URIs**: Add:
     - `https://localhost:3001/api/auth/callback/google`
2. Click **"Create"**

### Step 5: Get Your Credentials
A popup will show your credentials:
- **Client ID**: Copy this
- **Client Secret**: Copy this

You can also find them later by clicking on your OAuth client in the credentials list.

### Your Google Credentials:
```
GOOGLE_CLIENT_ID=<Client ID from Step 5>
GOOGLE_CLIENT_SECRET=<Client Secret from Step 5>
```

---

## 3. Additional Environment Variables

### Generate Encryption Key
Run this command in your terminal:
```bash
openssl rand -base64 32
```
Use the output as your ENCRYPTION_KEY.

### Generate Session Secret
Run this command in your terminal:
```bash
openssl rand -base64 32
```
Use the output as your SESSION_SECRET.

### Database URL
If using PostgreSQL:
```
DATABASE_URL=postgresql://username:password@localhost:5432/jason_db
```

If using SQLite (for development):
```
DATABASE_URL=file:./dev.db
```

---

## 4. Complete .env File

Create a `.env.local` file in your project root:

```env
# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT_ID=common

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=file:./dev.db

# Security
ENCRYPTION_KEY=your-generated-encryption-key
SESSION_SECRET=your-generated-session-secret

# Optional
NEXTAUTH_URL=https://localhost:3001
NODE_ENV=development
```

---

## 5. Testing Your Setup

1. Make sure your server is running: `npm run dev`
2. Go to https://localhost:3001/calendar-aggregator
3. Click "Add Calendar"
4. Try connecting Microsoft or Google
5. You should be redirected to login and then back to your app

## Troubleshooting

### Microsoft Issues:
- Make sure redirect URI matches exactly (including https://)
- Check that permissions are granted
- For localhost testing, you might need to use http://localhost:3001 instead

### Google Issues:
- Ensure your app is in "Testing" mode if using external user type
- Add your email as a test user
- Check that Calendar API is enabled

### SSL Certificate Issues:
- Browsers may warn about self-signed certificate
- Click "Advanced" and "Proceed to localhost"
- Or use http://localhost:3001 for testing

---

## Notes for Trademan & Targon

These appear to be custom/proprietary calendar systems. To integrate them, I need:

1. **API Documentation**: URL to their API docs
2. **Authentication Method**: 
   - OAuth2? (need client ID/secret)
   - API Key? (need the key)
   - Basic Auth? (need username/password)
3. **API Endpoints**: 
   - How to list calendars
   - How to get events
   - How to create/update events
4. **Any SDKs or Libraries** they provide

Without this information, I can only create placeholder integrations.