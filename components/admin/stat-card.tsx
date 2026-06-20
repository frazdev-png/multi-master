import type React from "react"
import { ArrowUp, ArrowDown } from "lucide-react"

export interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: "up" | "down"
  trendValue?: string
}

export function StatCard({ title, value, subtitle, icon, trend, trendValue }: StatCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 md:p-6 transition-all duration-200 hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl md:text-3xl font-bold text-foreground">{value}</p>
            {trend && trendValue && (
              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full ${trend === 'up' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                {trend === 'up' ? (
                  <ArrowUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDown className="w-3 h-3 mr-0.5" />
                )}
                {trendValue}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className="ml-4 p-2.5 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      </div>

      {/* Progress indicator (optional) */}
      {trend && (
        <div className="mt-4">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full ${trend === 'up' ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: trend === 'up' ? '75%' : '30%' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
