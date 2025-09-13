import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: LucideIcon
}

export default function StatsCard({ title, value, change, trend, icon: Icon }: StatsCardProps) {
  return (
    <div className="gradient-border hover-glow">
      <div className="gradient-border-content p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <Icon className="text-primary" size={24} />
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          
          <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>{change}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
