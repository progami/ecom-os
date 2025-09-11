import { AppLayout } from '@/components/layout/app-layout';
import { Mail, Search, Filter, Calendar, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EmailSummarizer() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Email Summarizer</h1>
          <p className="text-muted-foreground">AI-powered summaries for your important emails.</p>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Summaries
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-500 font-medium">+23%</span>
            </div>
            <p className="text-2xl font-bold">1,248</p>
            <p className="text-xs text-muted-foreground">Total Emails</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-blue-500 font-medium">Active</span>
            </div>
            <p className="text-2xl font-bold">342</p>
            <p className="text-xs text-muted-foreground">Summarized</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <p className="text-2xl font-bold">47</p>
            <p className="text-xs text-muted-foreground">New Emails</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-yellow-500 font-medium">Priority</span>
            </div>
            <p className="text-2xl font-bold">12</p>
            <p className="text-xs text-muted-foreground">Important</p>
          </div>
        </div>

        {/* Email List with Summaries */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Recent Email Summaries</h2>
          </div>
          <div className="divide-y">
            {/* Email Item 1 */}
            <div className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">Q4 Budget Review Meeting Notes</h3>
                    <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">Meeting</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">From: sarah.johnson@company.com</p>
                  <div className="bg-muted/50 p-3 rounded text-sm">
                    <p className="font-medium mb-1">AI Summary:</p>
                    <p className="text-muted-foreground">Budget review completed with 15% under-spend in Q4. Key decisions: 1) Reallocate marketing budget to R&D, 2) Approve new hiring for Q1, 3) Increase software licensing budget by 20%. Action items assigned to finance team with Dec 15 deadline.</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs text-muted-foreground">2h ago</p>
                  <Button variant="ghost" size="sm" className="mt-2">
                    View Full
                  </Button>
                </div>
              </div>
            </div>

            {/* Email Item 2 */}
            <div className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">Project Alpha - Status Update</h3>
                    <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">Project</span>
                    <Star className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">From: mike.chen@company.com</p>
                  <div className="bg-muted/50 p-3 rounded text-sm">
                    <p className="font-medium mb-1">AI Summary:</p>
                    <p className="text-muted-foreground">Project Alpha on track for Dec 20 launch. Completed: UI redesign (100%), backend API (95%), testing (60%). Risks: Integration with payment gateway delayed by 3 days. Mitigation: Team working overtime, vendor escalation in progress. Overall confidence: High.</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs text-muted-foreground">5h ago</p>
                  <Button variant="ghost" size="sm" className="mt-2">
                    View Full
                  </Button>
                </div>
              </div>
            </div>

            {/* Email Item 3 */}
            <div className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">Customer Feedback Summary - November</h3>
                    <span className="text-xs bg-purple-500/10 text-purple-500 px-2 py-1 rounded">Report</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">From: analytics@company.com</p>
                  <div className="bg-muted/50 p-3 rounded text-sm">
                    <p className="font-medium mb-1">AI Summary:</p>
                    <p className="text-muted-foreground">November NPS score: 72 (+5 from October). Top positive feedback: Fast customer support (45%), Product reliability (38%). Areas for improvement: Mobile app performance (23%), Documentation clarity (19%). Recommendation: Prioritize mobile optimization in Q1 roadmap.</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs text-muted-foreground">1d ago</p>
                  <Button variant="ghost" size="sm" className="mt-2">
                    View Full
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}