#!/bin/bash

# Check if server is already running
if lsof -i:3000 > /dev/null 2>&1; then
    echo "Test server already running on port 3000"
    exit 0
fi

echo "Starting test server..."

# Navigate to WMS directory
cd /Users/jarraramjad/Documents/ecom_os/WMS

# Set environment variables for test
export NODE_ENV=test
export DATABASE_URL="postgresql://jarraramjad@localhost:5432/warehouse_management?schema=public"
export NEXTAUTH_SECRET="your-secret-key-here-make-it-long-and-random"
export NEXTAUTH_URL="http://localhost:3000"

# Start the Next.js dev server in the background
npm run dev > /tmp/test-server.log 2>&1 &
SERVER_PID=$!

echo "Waiting for server to start (PID: $SERVER_PID)..."

# Wait for server to be ready
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "Test server ready!"
        echo $SERVER_PID > /tmp/test-server.pid
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "Failed to start test server. Check /tmp/test-server.log for details"
kill $SERVER_PID 2>/dev/null
exit 1