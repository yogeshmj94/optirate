import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Health check endpoint for Neon database connectivity.
 * 
 * Performs a simple query to verify:
 * - Prisma Client can connect to the Neon database
 * - The database schema is initialized
 * - Connection pooling is working correctly
 * 
 * Usage: GET /api/health
 * 
 * Returns 200 OK with database status if healthy.
 * Returns 503 Service Unavailable if the database is unreachable or uninitialized.
 */
export async function GET() {
  try {
    // Run a trivial query to test connectivity
    const borrowerCount = await prisma.borrower.count();
    
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        borrowerCount,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database health check failed';
    console.error('Health check error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: message,
      },
      { status: 503 }
    );
  }
}
