"use client"

import { Save, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRealtime } from "@/contexts/RealtimeContext"

const STAT_ICONS = [
  { value: "cart", label: "Cart" },
  { value: "users", label: "Users" },
  { value: "star", label: "Star" },
  { value: "trending", label: "Trending Up" },
  { value: "dollar", label: "Dollar" },
  { value: "package", label: "Package" },
  { value: "heart", label: "Heart" },
  { value: "zap", label: "Zap" },
]

interface StatConfig {
  value: string;
  label: string;
  icon: string;
  imageUrl?: string;
  imageFile?: File;
}

export default function HomepageSettings() {
  const { settings: realtimeSettings, updateSettings } = useRealtime()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  const defaultHeadline = useMemo(() => {
    const name = (realtimeSettings.website_name || "Sell1Mall").trim() || "Sell1Mall"
    return `Welcome to ${name} Marketplace`
  }, [realtimeSettings.website_name])

  const [heroBannerFile, setHeroBannerFile] = useState<File | null>(null)
  const [heroBannerUrl, setHeroBannerUrl] = useState<string | null>(null)
  const [headline, setHeadline] = useState("")
  const [subheadline, setSubheadline] = useState("")
  const [ctaText, setCtaText] = useState("")

  const [showFlashDeals, setShowFlashDeals] = useState(true)
  const [showFeaturedCategories, setShowFeaturedCategories] = useState(true)
  const [showFeaturedProducts, setShowFeaturedProducts] = useState(true)
  const [showPromotionalBanners, setShowPromotionalBanners] = useState(false)

  const [heroAvatars, setHeroAvatars] = useState<string[]>(["", "", ""])
  const [heroAvatarFiles, setHeroAvatarFiles] = useState<(File | null)[]>([null, null, null])

  const defaultStats: StatConfig[] = [
    { value: "1K+", label: "Products Listed", icon: "cart" },
    { value: "500K+", label: "Active Sellers", icon: "users" },
    { value: "50M+", label: "Happy Customers", icon: "star" },
    { value: "2M+", label: "Monthly Sales", icon: "trending" },
  ]
  const [stats, setStats] = useState<StatConfig[]>(defaultStats)

  useEffect(() => {
    const hs = (realtimeSettings as any)?.homepage_settings || {}
    setHeroBannerUrl(typeof hs.hero_banner_url === "string" ? hs.hero_banner_url : null)
    setHeadline(typeof hs.hero_headline === "string" ? hs.hero_headline : defaultHeadline)
    setSubheadline(typeof hs.hero_subheadline === "string" ? hs.hero_subheadline : "Discover premium products from trusted sellers")
    setCtaText(typeof hs.hero_cta_text === "string" ? hs.hero_cta_text : "Shop Now")

    setShowFlashDeals(hs.show_flash_deals !== false)
    setShowFeaturedCategories(hs.show_featured_categories !== false)
    setShowFeaturedProducts(hs.show_featured_products !== false)
    setShowPromotionalBanners(Boolean(hs.show_promotional_banners))

    if (Array.isArray(hs.stats)) {
      setStats(hs.stats)
    }

    if (Array.isArray(hs.hero_avatars)) {
      setHeroAvatars(hs.hero_avatars)
    }
  }, [realtimeSettings, defaultHeadline])

  const uploadAsset = async (type: "homepage_banner", file: File) => {
    const formData = new FormData()
    formData.append("type", type)
    formData.append("file", file)

    const res = await fetch("/api/backend/settings/upload", {
      method: "POST",
      body: formData,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success || !data?.url) {
      throw new Error(data?.message || data?.error || "Failed to upload file")
    }
    return String(data.url)
  }

  const heroBannerPreviewUrl = useMemo(() => {
    if (!heroBannerFile) return null
    return URL.createObjectURL(heroBannerFile)
  }, [heroBannerFile])

  useEffect(() => {
    return () => {
      if (heroBannerPreviewUrl) URL.revokeObjectURL(heroBannerPreviewUrl)
    }
  }, [heroBannerPreviewUrl])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage("")
    try {
      let bannerUrl = heroBannerUrl
      if (heroBannerFile) {
        bannerUrl = await uploadAsset("homepage_banner", heroBannerFile)
      }

      const updatedStats = await Promise.all(stats.map(async (s) => {
        const copy = { ...s }
        if (s.imageFile) {
          const formData = new FormData()
          formData.append("type", "homepage_banner")
          formData.append("file", s.imageFile)
          const res = await fetch("/api/backend/settings/upload", { method: "POST", body: formData })
          const d = await res.json()
          if (d?.success && d?.url) copy.imageUrl = String(d.url)
          delete copy.imageFile
        }
        return copy
      }))

      const updatedAvatars = await Promise.all(heroAvatarFiles.map(async (file, idx) => {
        if (file) {
          const formData = new FormData()
          formData.append("type", "homepage_banner")
          formData.append("file", file)
          const res = await fetch("/api/backend/settings/upload", { method: "POST", body: formData })
          const d = await res.json()
          return d?.success && d?.url ? String(d.url) : heroAvatars[idx]
        }
        return heroAvatars[idx]
      }))

      await updateSettings({
        homepage_settings: {
          hero_banner_url: bannerUrl,
          hero_headline: headline,
          hero_subheadline: subheadline,
          hero_cta_text: ctaText,
          show_flash_deals: showFlashDeals,
          show_featured_categories: showFeaturedCategories,
          show_featured_products: showFeaturedProducts,
          show_promotional_banners: showPromotionalBanners,
          stats: updatedStats,
          hero_avatars: updatedAvatars,
        },
      })

      setHeroBannerFile(null)
      setSaveMessage("Homepage settings saved")
    } catch (e: any) {
      setSaveMessage(e?.message || "Failed to save")
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(""), 3000)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Home Page Settings</h1>
        <p className="text-muted-foreground mt-1">Customize homepage layout and content</p>
      </div>

      {saveMessage ? <div className="text-sm text-muted-foreground">{saveMessage}</div> : null}

      {/* Hero Banner */}
      <div className="admin-panel-table p-6 space-y-4">
        <h2 className="text-xl font-bold">Hero Banner</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Banner Image</label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
            <input
              id="homepage-hero-banner"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setHeroBannerFile(f)
              }}
            />
            <label htmlFor="homepage-hero-banner" className="cursor-pointer">
              <Upload size={32} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm">{heroBannerFile ? heroBannerFile.name : "Click to upload banner image"}</p>
            </label>
            {heroBannerPreviewUrl || heroBannerUrl ? (
              <div className="mt-4">
                <img src={heroBannerPreviewUrl || heroBannerUrl || ""} alt="Hero banner" className="w-full max-h-48 object-cover rounded-md border border-border" />
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Headline</label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Subheadline</label>
          <Input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">CTA Button Text</label>
          <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
        </div>

        {/* Hero Avatars */}
        <div>
          <label className="block text-sm font-medium mb-2">Customer Avatars (3 images shown below buttons)</label>
          <div className="grid grid-cols-3 gap-4">
            {heroAvatars.map((url, idx) => (
              <div key={idx} className="border border-dashed border-border rounded-lg p-3 text-center">
                <input type="file" accept="image/*" className="hidden" id={`hero-avatar-${idx}`} onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    const a = [...heroAvatarFiles]; a[idx] = f; setHeroAvatarFiles(a)
                    const u = [...heroAvatars]; u[idx] = URL.createObjectURL(f); setHeroAvatars(u)
                  }
                }} />
                <label htmlFor={`hero-avatar-${idx}`} className="cursor-pointer block">
                  {url ? (
                    <img src={url} alt="" className="w-12 h-12 rounded-full object-cover mx-auto" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto flex items-center justify-center text-xs text-muted-foreground">+</div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">Avatar {idx + 1}</p>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Sections */}
      <div className="admin-panel-table p-6 space-y-4">
        <h2 className="text-xl font-bold">Display Settings</h2>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={showFlashDeals} onChange={(e) => setShowFlashDeals(e.target.checked)} className="w-4 h-4" />
            <span>Show Flash Deals</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={showFeaturedCategories} onChange={(e) => setShowFeaturedCategories(e.target.checked)} className="w-4 h-4" />
            <span>Show Featured Categories</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={showFeaturedProducts} onChange={(e) => setShowFeaturedProducts(e.target.checked)} className="w-4 h-4" />
            <span>Show Featured Products</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={showPromotionalBanners} onChange={(e) => setShowPromotionalBanners(e.target.checked)} className="w-4 h-4" />
            <span>Show Promotional Banners</span>
          </label>
        </div>
      </div>

      {/* Stats Section */}
      <div className="admin-panel-table p-6 space-y-4">
        <h2 className="text-xl font-bold">Stats Section</h2>
        <p className="text-sm text-muted-foreground">Configure the statistics shown on homepage</p>
        {stats.map((stat, i) => (
          <div key={i} className="border-b border-border pb-4 space-y-2">
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Label</label>
                <Input value={stat.label} onChange={(e) => {
                  const s = [...stats]; s[i] = { ...s[i], label: e.target.value }; setStats(s)
                }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Value</label>
                <Input value={stat.value} onChange={(e) => {
                  const s = [...stats]; s[i] = { ...s[i], value: e.target.value }; setStats(s)
                }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Icon</label>
                <Select value={stat.icon} onValueChange={(v) => {
                  const s = [...stats]; s[i] = { ...s[i], icon: v }; setStats(s)
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAT_ICONS.map((ic) => (
                      <SelectItem key={ic.value} value={ic.value}>{ic.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Custom Image (optional — replaces icon)</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" className="text-xs" onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    const s = [...stats]; s[i] = { ...s[i], imageFile: f, imageUrl: URL.createObjectURL(f) }; setStats(s)
                  }
                }} />
                {stat.imageUrl && (
                  <div className="relative">
                    <img src={stat.imageUrl} alt="" className="h-8 w-8 object-contain rounded" />
                    <button type="button" className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center" onClick={() => {
                      const s = [...stats]; s[i] = { ...s[i], imageUrl: undefined, imageFile: undefined }; setStats(s)
                    }}>×</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
          <Save size={18} />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
