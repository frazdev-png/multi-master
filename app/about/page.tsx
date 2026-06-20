"use client"

import Link from "next/link"
import { useRealtime } from "@/contexts/RealtimeContext"
import { Shield, Users, TrendingUp, Zap } from "lucide-react"

export default function AboutPage() {
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
          <h1 className="text-4xl font-bold mb-4">About Us</h1>
          <p className="text-lg text-muted-foreground mb-8">
            We empower entrepreneurs to build successful online stores and connect with customers worldwide.
          </p>

          <div className="prose prose-gray max-w-none mb-12">
            <p>
              {settings.website_name || "Sell1Mall"} is a leading multi-vendor e-commerce platform that connects
              sellers with millions of customers. Our mission is to provide everyone with the tools they need to
              start, grow, and manage their online business.
            </p>
            <p>
              Founded with a vision to democratize e-commerce, we offer a comprehensive suite of tools including
              store management, real-time messaging, order tracking, and marketing resources to help sellers
              succeed in the digital marketplace.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="p-6 bg-card rounded-lg border border-border">
              <Shield className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Trust & Security</h3>
              <p className="text-sm text-muted-foreground">
                Secure payments, buyer protection, and verified sellers ensure a safe shopping experience.
              </p>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <Users className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Community Driven</h3>
              <p className="text-sm text-muted-foreground">
                A thriving community of sellers and buyers building lasting relationships.
              </p>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <TrendingUp className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Growth Tools</h3>
              <p className="text-sm text-muted-foreground">
                Analytics, marketing tools, and insights to help your business scale.
              </p>
            </div>
            <div className="p-6 bg-card rounded-lg border border-border">
              <Zap className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Real-Time Support</h3>
              <p className="text-sm text-muted-foreground">
                Instant messaging and dedicated support to help you every step of the way.
              </p>
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
