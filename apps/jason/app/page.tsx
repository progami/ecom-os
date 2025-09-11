import { AppLayout } from '@/components/layout/app-layout';
import { Calendar, Mail, Users, Activity, TrendingUp, Clock, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Welcome back, John
          </h1>
          <p className="text-muted-foreground text-lg">Here's your productivity overview for today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-card/50 glass p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-300 animate-fade-up" style={{animationDelay: '0.1s'}}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div className="flex items-center gap-1 text-sm text-green-500 font-medium">
                <ArrowUp className="h-3 w-3" />
                12%
              </div>
            </div>
            <h3 className="text-3xl font-bold mb-1">24</h3>
            <p className="text-sm text-muted-foreground">Upcoming Events</p>
            <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-gradient-to-r from-primary to-accent rounded-full animate-shimmer" />
            </div>
          </div>

          <div className="group bg-card/50 glass p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-300 animate-fade-up" style={{animationDelay: '0.2s'}}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-accent/10 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <span className="text-sm text-blue-500 font-medium px-2 py-1 bg-blue-500/10 rounded-full">New</span>
            </div>
            <h3 className="text-3xl font-bold mb-1">142</h3>
            <p className="text-sm text-muted-foreground">Unread Emails</p>
            <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-gradient-to-r from-accent to-primary rounded-full animate-shimmer" />
            </div>
          </div>

          <div className="group bg-card/50 glass p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-300 animate-fade-up" style={{animationDelay: '0.3s'}}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-500/10 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
              <span className="text-sm text-orange-500 font-medium px-2 py-1 bg-orange-500/10 rounded-full">Active</span>
            </div>
            <h3 className="text-3xl font-bold mb-1">8</h3>
            <p className="text-sm text-muted-foreground">Team Members</p>
            <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full" />
            </div>
          </div>

          <div className="group bg-card/50 glass p-6 rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-300 animate-fade-up" style={{animationDelay: '0.4s'}}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500/10 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-6 w-6 text-purple-500" />
              </div>
              <span className="text-sm text-purple-500 font-medium px-2 py-1 bg-purple-500/10 rounded-full">High</span>
            </div>
            <h3 className="text-3xl font-bold mb-1">92%</h3>
            <p className="text-sm text-muted-foreground">Productivity Score</p>
            <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-[92%] bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card/50 glass p-6 rounded-xl border border-border/50 animate-fade-up" style={{animationDelay: '0.5s'}}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Recent Activity
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Calendar synced</p>
                    <p className="text-xs text-muted-foreground">All calendars are up to date</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">2m ago</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium">Email summary generated</p>
                    <p className="text-xs text-muted-foreground">15 threads processed</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">1h ago</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium">Meeting reminder</p>
                    <p className="text-xs text-muted-foreground">Team standup in 30 minutes</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">3h ago</span>
              </div>
            </div>
          </div>

          <div className="bg-card/50 glass p-6 rounded-xl border border-border/50 animate-fade-up" style={{animationDelay: '0.6s'}}>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/calendar-aggregator" className="block">
                <Button variant="outline" className="w-full justify-start group hover:bg-primary/10 hover:border-primary/50 transition-all duration-200">
                  <Calendar className="mr-2 h-4 w-4 group-hover:text-primary transition-colors" />
                  View Calendar
                </Button>
              </Link>
              <Link href="/email-summarizer" className="block">
                <Button variant="outline" className="w-full justify-start group hover:bg-accent/10 hover:border-accent/50 transition-all duration-200">
                  <Mail className="mr-2 h-4 w-4 group-hover:text-accent transition-colors" />
                  Check Email Summaries
                </Button>
              </Link>
              <Button variant="outline" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                <TrendingUp className="mr-2 h-4 w-4" />
                Generate Reports (Coming Soon)
              </Button>
              <Button variant="outline" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                <Clock className="mr-2 h-4 w-4" />
                Time Tracking (Coming Soon)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}