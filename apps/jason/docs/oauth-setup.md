# OAuth Setup Guide for Jason App

This guide will help you connect your real accounts (Outlook, Google Calendar) to the Jason app.

## Prerequisites

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Generate a secure session secret:
   ```bash
   openssl rand -base64 32
   ```
   Add this to `NEXTAUTH_SECRET` in your `.env` file.

3. Generate an encryption key (32 characters):
   ```bash
   openssl rand -hex 16
   ```
   Add this to `ENCRYPTION_KEY` in your `.env` file.

## Setting up Microsoft (Outlook) OAuth

### 1. Register your application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Configure your app:
   - Name: "Jason Calendar Aggregator"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: 
     - Platform: "Web"
     - URI: `https://localhost:3001/api/auth/callback/microsoft`

### 2. Configure API permissions

1. In your app, go to "API permissions"
2. Click "Add a permission" → "Microsoft Graph"
3. Add these delegated permissions:
   - `Calendars.Read`
   - `Calendars.ReadWrite`
   - `User.Read`
   - `offline_access` (for refresh tokens)

### 3. Get your credentials

1. Go to "Overview" and copy the "Application (client) ID"
2. Go to "Certificates & secrets" → "Client secrets"
3. Click "New client secret" and copy the value immediately
4. Add these to your `.env`:
   ```
   MICROSOFT_CLIENT_ID="your_client_id_here"
   MICROSOFT_CLIENT_SECRET="your_client_secret_here"
   ```

## Setting up Google OAuth

### 1. Create a project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Configure OAuth consent screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "Jason Calendar Aggregator"
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/userinfo.email`

### 3. Create OAuth credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Configure:
   - Name: "Jason Web Client"
   - Authorized redirect URIs: `https://localhost:3001/api/auth/callback/google`
5. Copy the Client ID and Client Secret
6. Add these to your `.env`:
   ```
   GOOGLE_CLIENT_ID="your_client_id_here"
   GOOGLE_CLIENT_SECRET="your_client_secret_here"
   ```

## Important Security Notes

### For Development (localhost)

- Both Microsoft and Google support `https://localhost` redirect URIs for development
- Make sure you're using HTTPS (the app already does this)
- The self-signed certificate warnings are normal in development

### For Production

When deploying to production, you'll need to:

1. Update redirect URIs in both Azure and Google Cloud Console
2. Change `NEXTAUTH_URL` in your `.env` to your production URL
3. Use proper SSL certificates (not self-signed)
4. Add your production domain to the OAuth consent screen

## Testing Your Setup

1. Make sure your `.env` file has all required values
2. Restart your development server:
   ```bash
   npm run dev
   ```
3. Go to https://localhost:3001/calendar-aggregator
4. Click "Add Calendar" and choose a provider
5. You should be redirected to the provider's login page

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in your `.env` exactly matches what's configured in Azure/Google
- Check that you're using HTTPS, not HTTP
- Ensure there's no trailing slash

### "Invalid client" error
- Double-check your client ID and secret
- Make sure there are no extra spaces or quotes in your `.env` file

### Token storage issues
- Ensure your `ENCRYPTION_KEY` is exactly 32 characters
- Check that the database is properly initialized

## Next Steps

Once you've set up OAuth:

1. Connect your calendars through the UI
2. The app will securely store your refresh tokens
3. Calendars will sync automatically
4. You can manage connected accounts in Settings