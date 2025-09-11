# MCP Servers Configuration

This document explains the Model Context Protocol (MCP) servers configured for Ecom OS projects.

## What are MCP Servers?

MCP servers provide Claude with enhanced capabilities through specialized tools. They run as separate processes and communicate with Claude via the Model Context Protocol.

## Configured Servers

### 1. **Playwright** (`@automatalabs/mcp-server-playwright`)
- **Purpose**: Browser automation and testing
- **Use Cases**: 
  - Automated UI testing
  - Web scraping
  - Screenshot generation
  - Form filling and interaction testing

### 2. **Google Drive** (`@modelcontextprotocol/server-gdrive`)
- **Purpose**: Access and manage Google Drive files
- **Use Cases**:
  - Reading/writing documents
  - Managing spreadsheets for data import/export
  - Backup and sync operations
- **Required ENV**:
  ```bash
  GDRIVE_CLIENT_ID=your_client_id
  GDRIVE_CLIENT_SECRET=your_client_secret
  ```

### 3. **GitHub** (`@modelcontextprotocol/server-github`)
- **Purpose**: Enhanced GitHub operations
- **Use Cases**:
  - Creating/managing issues
  - Pull request operations
  - Repository management
  - Code reviews
- **Required ENV**:
  ```bash
  GITHUB_PERSONAL_ACCESS_TOKEN=your_token
  ```

### 4. **PostgreSQL** (`@modelcontextprotocol/server-postgres`)
- **Purpose**: Direct database operations
- **Use Cases**:
  - Database queries
  - Schema inspection
  - Data migration
  - Performance analysis
- **Required ENV**:
  ```bash
  DATABASE_URL=postgresql://user:pass@host:port/db
  ```

### 5. **SQLite** (`@modelcontextprotocol/server-sqlite`)
- **Purpose**: Local database operations
- **Use Cases**:
  - Development database access
  - Quick data queries
  - Schema testing
- **Configuration**: Points to `./prisma/dev.db`

### 6. **Filesystem** (`@modelcontextprotocol/server-filesystem`)
- **Purpose**: Enhanced file system operations
- **Use Cases**:
  - Bulk file operations
  - Directory scanning
  - File watching
- **Configuration**: Root set to `~/Documents/ecom_os`

### 7. **Memory** (`@modelcontextprotocol/server-memory`)
- **Purpose**: Persistent memory across conversations
- **Use Cases**:
  - Storing context between sessions
  - Maintaining project state
  - Tracking ongoing tasks

### 8. **Git** (`@modelcontextprotocol/server-git`)
- **Purpose**: Advanced git operations
- **Use Cases**:
  - Complex git workflows
  - Branch management
  - Commit history analysis
  - Merge conflict resolution

### 9. **REST API** (`dkmaker-mcp-rest-api`)
- **Purpose**: HTTP/REST API interactions
- **Use Cases**:
  - API testing
  - External service integration
  - Webhook testing
- **Configuration**: Base URL set to `http://localhost:3000`

### 10. **Docker** (`@docker/mcp-server`)
- **Purpose**: Docker container management
- **Use Cases**:
  - Container operations
  - Image management
  - Docker Compose workflows
  - Development environment setup

### 11. **Fetch** (`@modelcontextprotocol/server-fetch`)
- **Purpose**: Advanced HTTP operations
- **Use Cases**:
  - Web scraping
  - API consumption
  - Content fetching
  - Network testing

### 12. **Time** (`@modelcontextprotocol/server-time`)
- **Purpose**: Time and date operations
- **Use Cases**:
  - Scheduling tasks
  - Time zone conversions
  - Date calculations
  - Cron job management

## Setup Instructions

1. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Verify MCP Configuration**
   ```bash
   # The .mcp.json file should be in your project root
   cat .mcp.json
   ```

3. **Test MCP Servers**
   - Restart Claude
   - Check the MCP icon in Claude's interface
   - Verify servers are connected

## Troubleshooting

### Server Not Connecting
- Check environment variables are set
- Ensure npx is available in PATH
- Verify internet connection for package downloads
- Check Claude's MCP logs

### Permission Issues
- Ensure file system permissions for filesystem server
- Check database credentials
- Verify API tokens are valid

### Performance Issues
- Disable unused servers in .mcp.json
- Check system resources
- Update server packages: `npx @modelcontextprotocol/server-name@latest`

## Best Practices

1. **Security**
   - Never commit real credentials
   - Use environment variables
   - Rotate tokens regularly

2. **Performance**
   - Only enable servers you need
   - Monitor resource usage
   - Keep servers updated

3. **Development**
   - Test MCP operations locally first
   - Document custom server usage
   - Share configurations with team

## Adding New Servers

To add a new MCP server:

1. Find the server package on npm
2. Add to `.mcp.json`:
   ```json
   "server-name": {
     "command": "npx",
     "args": ["-y", "@namespace/server-name@latest"],
     "env": {
       "REQUIRED_VAR": "${REQUIRED_VAR}"
     }
   }
   ```
3. Update `.env.example` with required variables
4. Document the server's purpose and use cases

## Resources

- [MCP Documentation](https://docs.anthropic.com/mcp)
- [Available MCP Servers](https://github.com/modelcontextprotocol)
- [Creating Custom Servers](https://docs.anthropic.com/mcp/creating-servers)