# CSRF Redis Setup Guide

## Overview
CSRF tokens are now persisted in Redis for horizontal scalability. This allows tokens to be validated across multiple server instances.

## Configuration

### Environment Variables
```env
# Redis connection (required for production)
REDIS_URL=redis://localhost:6379

# Force Redis usage in development
USE_REDIS=true

# CSRF token TTL (optional, defaults to 24 hours)
CSRF_TOKEN_TTL=86400000
```

### Docker Compose for Local Redis
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    
volumes:
  redis-data:
```

## Architecture

### Token Storage Flow
1. User session initiates → Generate CSRF token
2. Token stored in Redis with key: `csrf:{sessionId}`
3. Token expires after 24 hours (configurable)
4. On validation, token retrieved from Redis
5. Token cleared on logout

### Fallback Strategy
- **Production**: Redis (required)
- **Development**: In-memory fallback if Redis unavailable
- **Testing**: In-memory store

## Implementation Details

### Redis Store Features
- Automatic retry on connection failure (3 attempts)
- Graceful fallback to memory store if Redis unavailable
- Connection pooling via ioredis
- TTL-based automatic expiration
- Health check endpoint

### Key Format
```
csrf:{sessionId}
```

### Data Format
```json
{
  "token": "hex_token_string",
  "expires": 1234567890000,
  "createdAt": 1234567890000
}
```

## Monitoring

### Health Check Endpoint
```bash
GET /api/admin/csrf-health

# Response
{
  "csrf": {
    "healthy": true,
    "type": "redis",
    "details": {
      "totalTokens": 42,
      "memoryUsage": 8192
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Redis Monitoring Commands
```bash
# Check Redis connection
redis-cli ping

# Count CSRF tokens
redis-cli --scan --pattern "csrf:*" | wc -l

# Check memory usage
redis-cli info memory

# Monitor commands in real-time
redis-cli monitor
```

## Scaling Considerations

### Multiple Instances
- All instances must connect to the same Redis instance/cluster
- Use Redis Sentinel or Cluster for HA
- Configure connection pooling appropriately

### Performance
- Token validation: ~1-2ms with local Redis
- Token generation: ~2-3ms including storage
- Memory usage: ~200 bytes per token

### Redis Cluster Configuration
```javascript
// For Redis Cluster (future enhancement)
new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD
  }
})
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check Redis is running: `docker ps`
   - Verify REDIS_URL is correct
   - Check firewall/security groups

2. **Tokens Not Persisting**
   - Check Redis connection: `redis-cli ping`
   - Verify key format: `redis-cli keys "csrf:*"`
   - Check TTL: `redis-cli ttl "csrf:session_id"`

3. **Memory Issues**
   - Monitor usage: `redis-cli info memory`
   - Configure maxmemory policy
   - Implement token cleanup job

### Debug Mode
```env
# Enable CSRF debug logging
DEBUG_CSRF=true
```

## Migration from In-Memory

### Steps
1. Deploy Redis infrastructure
2. Update environment variables
3. Deploy application with Redis store
4. Monitor health endpoint
5. Verify cross-instance validation

### Rollback Plan
1. Set `USE_REDIS=false` to force memory store
2. Deploy without Redis dependency
3. Investigate Redis issues offline

## Security Notes

- Redis should be password-protected in production
- Use TLS for Redis connections in production
- Implement rate limiting on token generation
- Monitor for anomalous token creation patterns
- Regular token cleanup for expired sessions