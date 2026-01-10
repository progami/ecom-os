#!/bin/bash

# Stop the test server if it's running
if [ -f /tmp/test-server.pid ]; then
    PID=$(cat /tmp/test-server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping test server (PID: $PID)..."
        kill $PID
        rm /tmp/test-server.pid
        echo "Test server stopped"
    else
        echo "Test server not running"
        rm /tmp/test-server.pid
    fi
else
    # Check if any process is using port 3000
    if lsof -i:3000 > /dev/null 2>&1; then
        echo "Found process on port 3000, killing it..."
        lsof -ti:3000 | xargs kill -9
        echo "Process killed"
    else
        echo "No test server running"
    fi
fi