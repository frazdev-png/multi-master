"use client"

import Link from "next/link"
import { useRealtime } from "@/contexts/RealtimeContext"
import { BookOpen, BarChart3, MessageCircle, DollarSign, ShieldCheck, TrendingUp } from "lucide-react"

export default function SellerResourcesPage() {
  const { settings } = useRealtime()

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/" className="text-xl font-bold text-primary">
            {settings.website_name || "Sell1Mall"}
          </Link>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Seller Resources</h1>
          <p className="text-lg text-muted-foreground mb-12">
            Everything you need to start, grow, and manage your online store.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="p-6 bg-card rounded-lg border border-border">
              <BookOpen className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Seller Guide</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Step-by-step guide to setting up and optimizing your store for maximum sales.
              </p>
              <Link href="/auth/register?role=seller" className="text-sm text-primary hover:underline">
                Start Selling →
              </Link>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <BarChart3 className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Analytics & Insights</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Track your sales, view customer behavior, and make data-driven decisions.
              </p>
              <Link href="/seller/analytics" className="text-sm text-primary hover:underline">
                View Analytics →
              </Link>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <MessageCircle className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Customer Communication</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use our real-time messaging system to connect with customers instantly.
              </p>
              <Link href="/seller/messages" className="text-sm text-primary hover:underline">
                Open Messages →
              </Link>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <DollarSign className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Pricing & Fees</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Transparent pricing with competitive commission rates. No hidden fees.
              </p>
              <Link href="/auth/register?role=seller" className="text-sm text-primary hover:underline">
                Learn More →
              </Link>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <ShieldCheck className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Seller Protection</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We protect sellers from fraudulent transactions and chargebacks.
              </p>
              <Link href="/terms" className="text-sm text-primary hover:underline">
                View Policy →
              </Link>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <TrendingUp className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Growth Tips</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Best practices for product photography, pricing strategies, and marketing.
              </p>
              <Link href="/auth/register?role=seller" className="text-sm text-primary hover:underline">
                Get Started →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 {settings.website_name || "Sell1Mall"}. All rights reserved.</p>
      </footer>
    </div>
  )
}
