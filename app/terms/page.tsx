"use client"

import Link from "next/link"
import { useRealtime } from "@/contexts/RealtimeContext"

export default function TermsPage() {
  const { settings } = useRealtime()
  const termsContent = (settings as any)?.terms_conditions || ""

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
          <h1 className="text-4xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-lg text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="prose prose-gray max-w-none space-y-6">
            {termsContent ? (
              <div dangerouslySetInnerHTML={{ __html: termsContent }} />
            ) : (
              <>
                <h2 className="text-2xl font-semibold mt-8">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using {settings.website_name || "Sell1Mall"}, you agree to comply with and be
                  bound by these Terms & Conditions. If you do not agree with any part of these terms, you may
                  not use our services.
                </p>

                <h2 className="text-2xl font-semibold mt-8">2. Seller Responsibilities</h2>
                <p>
                  Sellers are responsible for maintaining accurate product listings, fulfilling orders in a
                  timely manner, and providing accurate descriptions and pricing. Failure to comply may result
                  in account suspension.
                </p>

                <h2 className="text-2xl font-semibold mt-8">3. Buyer Protection</h2>
                <p>
                  We are committed to providing a safe shopping experience. Buyers are protected by our
                  buyer protection policy which covers non-delivery, misrepresentation, and unauthorized
                  transactions.
                </p>

                <h2 className="text-2xl font-semibold mt-8">4. Prohibited Items</h2>
                <p>
                  The following items are prohibited from being listed on our platform: counterfeit goods,
                  illegal items, hazardous materials, and any items that infringe on intellectual property
                  rights.
                </p>

                <h2 className="text-2xl font-semibold mt-8">5. Dispute Resolution</h2>
                <p>
                  Any disputes arising from transactions on our platform will be resolved through our
                  mediation process. We encourage sellers and buyers to communicate directly to resolve
                  issues before escalating.
                </p>

                <h2 className="text-2xl font-semibold mt-8">6. Limitation of Liability</h2>
                <p>
                  {settings.website_name || "Sell1Mall"} acts as a marketplace platform and is not liable
                  for any direct, indirect, incidental, or consequential damages arising from transactions
                  between users.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 {settings.website_name || "Sell1Mall"}. All rights reserved.</p>
      </footer>
    </div>
  )
}
