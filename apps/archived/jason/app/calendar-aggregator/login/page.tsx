'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');

  const handleLogin = async () => {
    // Log login attempt (in real app, this would be logged server-side)
    console.log('[CLIENT] [CalendarAuth] Login attempt for email:', email.replace(/@.*/, '@***'));
    
    try {
      // For demo purposes, just redirect to dashboard
      // In real app, this would make an API call
      console.log('[CLIENT] [CalendarAuth] Login successful, redirecting to dashboard');
      router.push('/calendar-aggregator/dashboard');
    } catch (error) {
      console.error('[CLIENT] [CalendarAuth] Login failed:', error);
    }
  };
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome Back</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to access your unified calendar
          </p>
          <p className="mt-4 text-sm text-muted-foreground bg-secondary p-3 rounded-md">
            Demo credentials are pre-filled for testing
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <Button className="w-full" onClick={handleLogin}>Sign In</Button>
          </div>
          
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don&apos;t have an account? </span>
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}