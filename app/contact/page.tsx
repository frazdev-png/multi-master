"use client"

import Link from "next/link"
import { useRealtime } from "@/contexts/RealtimeContext"
import { Mail, Phone, MapPin, Clock, MessageCircle } from "lucide-react"

export default function ContactPage() {
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
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-lg text-muted-foreground mb-12">
            Have a question or need help? We are here for you.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="flex items-start gap-4 p-6 bg-card rounded-lg border border-border">
              <Mail className="w-6 h-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Email</h3>
                <p className="text-muted-foreground">support@sell1mall.com</p>
                <p className="text-muted-foreground">We reply within 24 hours</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card rounded-lg border border-border">
              <Phone className="w-6 h-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Phone</h3>
                <p className="text-muted-foreground">+1 (555) 123-4567</p>
                <p className="text-muted-foreground">Mon-Fri 9AM-6PM</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card rounded-lg border border-border">
              <MapPin className="w-6 h-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Address</h3>
                <p className="text-muted-foreground">123 Commerce Street</p>
                <p className="text-muted-foreground">New York, NY 10001</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card rounded-lg border border-border">
              <Clock className="w-6 h-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Business Hours</h3>
                <p className="text-muted-foreground">Monday - Friday: 9AM - 6PM</p>
                <p className="text-muted-foreground">Saturday: 10AM - 4PM</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-8">
            <h2 className="text-2xl font-semibold mb-6">Send Us a Message</h2>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Your email"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[150px]"
                  placeholder="Write your message..."
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 {settings.website_name || "Sell1Mall"}. All rights reserved.</p>
      </footer>
    </div>
  )
}
