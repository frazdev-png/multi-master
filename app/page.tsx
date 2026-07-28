"use client"

import Link from "next/link"
import { ShoppingCart, Users, TrendingUp, Zap, ArrowRight, Star, Shield, Truck, Menu, X, MessageCircle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useRealtime } from "@/contexts/RealtimeContext"
import { useState } from "react"
import Image from "next/image"
import heroBanner from "../public/Home.jpg"


function resolvePublicImageUrl(src: string | undefined) {
  const raw = String(src || "").trim()
  if (!raw) return ""

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      if (u.pathname.startsWith("/uploads/")) return u.pathname
      if (u.pathname.startsWith("/api/uploads/")) return u.pathname.replace("/api/uploads/", "/uploads/")
    } catch {
    }
    return raw
  }

  if (raw.startsWith("//")) return `https:${raw}`
  if (raw.startsWith("/api/uploads/")) return raw.replace("/api/uploads/", "/uploads/")
  if (raw.startsWith("api/uploads/")) return `/${raw.replace("api/uploads/", "uploads/")}`
  if (raw.startsWith("uploads/")) return `/${raw}`
  if (raw.startsWith("/uploads/")) return raw

  return raw
}

export default function Home() {
  const { settings } = useRealtime()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const heroBannerUrl = resolvePublicImageUrl((settings as any)?.homepage_settings?.hero_banner_url)
  const logoUrl = resolvePublicImageUrl((settings as any)?.logo_url)
  const hs = (settings as any)?.homepage_settings || {}
  const heroHeadline = hs.hero_headline || settings.tagline || "Your Multi-Vendor Marketplace"
  const heroSubheadline = hs.hero_subheadline || "Experience seamless shopping with trusted sellers, powerful seller tools, and a growing community. All in one professional platform."
  const heroCtaText = hs.hero_cta_text || "Start Shopping"

  const statIcons: Record<string, JSX.Element> = {
    cart: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    users: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    star: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    trending: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
    dollar: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    package: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>,
    heart: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    zap: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  }

  const defaultStats = [
    { value: "1K+", label: "Products Listed", icon: "cart" },
    { value: "500K+", label: "Active Sellers", icon: "users" },
    { value: "50M+", label: "Happy Customers", icon: "star" },
    { value: "2M+", label: "Monthly Sales", icon: "trending" },
  ]
  const stats = Array.isArray(hs.stats) && hs.stats.length === 4 ? hs.stats : defaultStats
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center text-xl sm:text-2xl font-bold text-primary truncate min-w-0 max-w-[55vw] sm:max-w-none"
            >
              <img
                src={logoUrl || "/sell1mall-logo.png"}
                alt={settings.website_name || "Sell1Mall"}
                className="w-64 object-contain"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).src = "/placeholder.svg"
                }}
              />
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />

              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((v) => !v)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className="hidden md:flex items-center gap-8">
                <Link href="/shop" className="text-foreground hover:text-primary transition-colors font-medium text-sm">
                  Shop
                </Link>
                <Link
                  href="/messaging"
                  className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors font-medium text-sm"
                >
                  <MessageCircle size={16} />
                  Chat
                </Link>
                <Link
                  href="/auth/login"
                  className="text-foreground hover:text-primary transition-colors font-medium text-sm"
                >
                  Login
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm">
                  Sign Up
                </Link>
              </div>
            </div>
          </div>

          <div
            className={`md:hidden overflow-hidden transition-all duration-200 ${
              mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="border-t border-border py-4">
              <div className="flex flex-col gap-1">
                <Link
                  href="/shop"
                  className="px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Shop
                </Link>
                <Link
                  href="/messaging"
                  className="px-3 py-2 rounded-lg hover:bg-muted transition-colors inline-flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageCircle size={16} />
                  Chat
                </Link>
                <Link
                  href="/auth/login"
                  className="px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="btn-primary text-sm inline-flex items-center justify-center px-3 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold text-balance leading-tight">
                {heroHeadline}
              </h1>
              <p className="text-xl text-muted-foreground text-balance leading-relaxed">
                {heroSubheadline}
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/shop" className="btn-primary inline-flex items-center gap-2 text-base">
                {heroCtaText}
                <ArrowRight size={20} />
              </Link>
              <Link href="/auth/register?role=seller" className="btn-secondary text-base">
                Become a Seller
              </Link>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-8 h-8 bg-primary/20 rounded-full border-2 border-card"></div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">50M+ happy customers</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl blur-3xl"></div>
            <Image
              src={heroBannerUrl || heroBanner}
              alt={`${settings.website_name || "Sell1Mall"} Platform`}
              className="relative w-full h-full object-cover rounded-2xl shadow-xl"
              width={800}
              height={600}
              priority
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement
                if (el.src.endsWith("/placeholder.svg")) return
                el.src = "/placeholder.svg"
              }}
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card border-y border-border py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2>Why Choose {settings.website_name || "Sell1Mall"}?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to shop smart and sell successfully
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <ShoppingCart size={24} />,
                title: "Wide Selection",
                desc: "Thousands of curated products from verified sellers",
              },
              {
                icon: <TrendingUp size={24} />,
                title: "Grow Your Business",
                desc: "Advanced analytics and seller tools for growth",
              },
              {
                icon: <Zap size={24} />,
                title: "Fast Checkout",
                desc: "Secure payments with multiple payment options",
              },
              {
                icon: <Users size={24} />,
                title: "Thriving Community",
                desc: "Connect directly with buyers and sellers",
              },
            ].map((feature, i) => (
              <div key={i} className="card text-center hover:border-primary/50 group">
                <div className="text-primary mb-4 flex justify-center group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="card text-center">
              <div className="text-primary mb-3 flex justify-center">
                {stat.imageUrl ? (
                  <img src={stat.imageUrl} alt="" className="h-8 w-8 object-contain" />
                ) : (
                  statIcons[stat.icon] || statIcons.star
                )}
              </div>
              <p className="text-4xl font-bold text-foreground mb-2">{stat.value}</p>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-card py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2>How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Simple steps to get you started</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: 1,
                title: "Browse & Select",
                desc: "Explore thousands of products from multiple verified sellers",
                icon: <ShoppingCart size={28} />,
              },
              {
                num: 2,
                title: "Secure Checkout",
                desc: "Safe payment with wallet, card, or online payment options",
                icon: <Shield size={28} />,
              },
              {
                num: 3,
                title: "Track & Receive",
                desc: "Real-time tracking and fast delivery to your door",
                icon: <Truck size={28} />,
              },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="card text-center">
                  <div className="bg-primary/10 text-primary w-14 h-14 rounded-full flex items-center justify-center font-bold mb-4 mx-auto">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-br from-primary via-primary to-accent text-white rounded-2xl p-16 text-center overflow-hidden relative">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="relative space-y-8">
            <h2 className="text-4xl font-bold">Ready to Get Started?</h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              Join thousands of customers enjoying quality shopping and sellers building successful businesses.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/shop"
                className="bg-white text-primary px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
              >
                Shop Now
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/auth/register?role=seller"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-bold hover:bg-white/10 transition-colors"
              >
                Become Seller
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-24">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <h3 className="font-bold text-lg">{settings.website_name || "Your Store"}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your trusted multi-vendor marketplace for quality products and exceptional service.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Customers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/shop" className="hover:text-primary transition-colors">
                    Shop
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-primary transition-colors">
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Sellers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/auth/register?role=seller" className="hover:text-primary transition-colors">
                    Join as Seller
                  </Link>
                </li>
                <li>
                  <Link href="/seller-resources" className="hover:text-primary transition-colors">
                    Seller Resources
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Growth Tools
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-primary transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-primary transition-colors">
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© 2025 {settings.website_name || "Your Store"}. All rights reserved. | Designed for excellence.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
