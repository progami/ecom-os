import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { devLog } from '@/lib/logging';

export async function POST() {
  try {
    // The stale sync ID that keeps appearing
    const staleSyncId = 'd4e9ae94-b9b1-494f-844b-cde2f4985087';
    
    // Delete from Redis if it exists
    const key = `sync_progress:${staleSyncId}`;
    const deleted = await redis.del(key);
    
    devLog('CLEANUP', `Deleted stale sync ID from Redis`, { 
      syncId: staleSyncId,
      redisDeleted: deleted,
      key 
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Stale sync ID cleaned up',
      redisDeleted: deleted > 0
    });
  } catch (error) {
    devLog('CLEANUP', 'Failed to cleanup stale sync', { error });
    return NextResponse.json(
      { error: 'Failed to cleanup stale sync' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check if the stale sync ID exists in Redis
    const staleSyncId = 'd4e9ae94-b9b1-494f-844b-cde2f4985087';
    const key = `sync_progress:${staleSyncId}`;
    const exists = await redis.exists(key);
    
    return NextResponse.json({ 
      exists: exists > 0,
      syncId: staleSyncId,
      key
    });
  } catch (error) {
    devLog('CLEANUP', 'Failed to check stale sync', { error });
    return NextResponse.json(
      { error: 'Failed to check stale sync' },
      { status: 500 }
    );
  }
}