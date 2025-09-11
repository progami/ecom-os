# MCP Server Setup Guide

## Overview

This guide helps you configure the MCP (Model Context Protocol) servers for CentralDB.

## Configured Servers

### 1. Filesystem Server ✅
- **Status**: Ready to use
- **Access**: `/Users/jarraramjad/Documents/ecom_os`
- **No configuration needed**

### 2. GitHub Server 🔧
To enable:
1. Generate a GitHub Personal Access Token:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Create a token with `repo` scope
2. Replace `<YOUR_GITHUB_TOKEN>` in `.mcp.json`

### 3. PostgreSQL Server 🔧
To enable:
1. Update the connection string in `.mcp.json`:
   - Replace `username` and `password`
   - Ensure database `centraldb` exists

### 4. Google Drive Server 🔧
To enable:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Drive API:
   - APIs & Services → Enable APIs → Search "Google Drive API" → Enable
4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/oauth/callback`
5. Download credentials and update `.mcp.json`:
   - `GDRIVE_CLIENT_ID`
   - `GDRIVE_CLIENT_SECRET`

### 5. Slack Server 🔧
To enable:
1. Create a Slack app at [api.slack.com](https://api.slack.com)
2. Add OAuth scopes: `channels:read`, `chat:write`, `files:read`
3. Install to workspace
4. Copy Bot User OAuth Token to `SLACK_BOT_TOKEN` in `.mcp.json`

### 6. Memory Server ✅
- **Status**: Ready to use
- **Provides persistent memory across sessions**
- **No configuration needed**

## Usage

After configuring `.mcp.json`:

1. Restart Claude Desktop or reload with `claude mcp`
2. Look for the MCP icon in Claude's interface
3. Available tools will appear based on enabled servers

## Security Notes

- Never commit `.mcp.json` with real credentials
- Use environment variables for production
- Rotate tokens regularly
- Consider using `.mcp.json.example` for templates

## Quick Test

To test if MCP is working:
```bash
clause mcp list
```

This should show all configured servers.