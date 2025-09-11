import { Button } from '@/components/ui/button';
import { Calendar, Plus, Settings, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Calendar Dashboard</h1>
          <div className="flex gap-4">
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline">Sign Out</Button>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Connected Calendars</h2>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Calendar
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold">Outlook - K-State</h3>
                <p className="text-sm text-muted-foreground">Last synced: 5 min ago</p>
              </div>
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Connected</span>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg border border-dashed">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Add Trademan Calendar</p>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg border border-dashed">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Add Targon Calendar</p>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Upcoming Events</h2>
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              Connect your calendars to see upcoming events
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}