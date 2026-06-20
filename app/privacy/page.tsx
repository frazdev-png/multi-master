"use client"

import Link from "next/link"
import { useRealtime } from "@/contexts/RealtimeContext"

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <h2 className="text-2xl font-semibold mt-8">1. Information We Collect</h2>
            <p>
              We collect information you provide when creating an account, making a purchase, or communicating
              with us. This includes your name, email address, phone number, shipping address, and payment
              information.
            </p>

            <h2 className="text-2xl font-semibold mt-8">2. How We Use Your Information</h2>
            <p>
              Your information is used to process transactions, provide customer support, improve our services,
              and send relevant communications about your account or orders. We do not sell your personal
              information to third parties.
            </p>

            <h2 className="text-2xl font-semibold mt-8">3. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information. All
              payment transactions are encrypted using SSL technology. However, no method of transmission
              over the Internet is 100% secure.
            </p>

            <h2 className="text-2xl font-semibold mt-8">4. Cookies</h2>
            <p>
              We use cookies and similar tracking technologies to enhance your browsing experience, analyze
              site traffic, and understand where our visitors come from. You can control cookie preferences
              through your browser settings.
            </p>

            <h2 className="text-2xl font-semibold mt-8">5. Third-Party Services</h2>
            <p>
              We may employ third-party companies and individuals to facilitate our services, provide
              payment processing, or analyze how our service is used. These third parties have access to
              your information only to perform these tasks.
            </p>

            <h2 className="text-2xl font-semibold mt-8">6. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal information at any time. You
              can do this through your account settings or by contacting our support team.
            </p>

            <h2 className="text-2xl font-semibold mt-8">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at
              support@sell1mall.com.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 {settings.website_name || "Sell1Mall"}. All rights reserved.</p>
      </footer>
    </div>
  )
}
