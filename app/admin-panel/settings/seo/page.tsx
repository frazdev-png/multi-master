"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Globe, BarChart3, Download, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

export default function SEOToolsPage() {
  const [seoSettings, setSeoSettings] = useState({
    siteTitle: "",
    siteDescription: "",
    keywords: "",
    ogImage: "",
    twitterHandle: "",
    googleAnalytics: "",
    googleTagManager: "",
    enableSitemap: true,
    enableRobots: true,
  })

  const [metaTags, setMetaTags] = useState<Array<{ name: string; content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [sitemapLastGeneratedAt, setSitemapLastGeneratedAt] = useState<string>("")

  const sitemapUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/sitemap.xml`
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoading(true)
        setError("")
        setSuccess("")
        const res = await fetch("/api/settings")
        const data = await res.json().catch(() => null)
        if (!data?.success) {
          throw new Error(data?.message || "Failed to load settings")
        }

        const ss = data?.data?.seo_settings || {}

        if (cancelled) return
        setSeoSettings({
          siteTitle: ss.siteTitle || "",
          siteDescription: ss.siteDescription || "",
          keywords: ss.keywords || "",
          ogImage: ss.ogImage || "",
          twitterHandle: ss.twitterHandle || "",
          googleAnalytics: ss.googleAnalytics || "",
          googleTagManager: ss.googleTagManager || "",
          enableSitemap: typeof ss.enableSitemap === "boolean" ? ss.enableSitemap : true,
          enableRobots: typeof ss.enableRobots === "boolean" ? ss.enableRobots : true,
        })
        setMetaTags(Array.isArray(ss.metaTags) ? ss.metaTags : [])
        setSitemapLastGeneratedAt(ss.sitemap_last_generated_at || "")
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load settings")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const saveSeoSettings = async () => {
    try {
      setIsLoading(true)
      setError("")
      setSuccess("")
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seo_settings: {
            ...seoSettings,
            metaTags,
            sitemap_last_generated_at: sitemapLastGeneratedAt,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!data?.success) {
        throw new Error(data?.message || "Failed to save settings")
      }
      setSuccess("Saved")
    } catch (e: any) {
      setError(e?.message || "Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }

  const generateSitemap = async () => {
    const now = new Date().toISOString()
    setSitemapLastGeneratedAt(now)
    await saveSeoSettings()
  }

  const addMetaTag = () => {
    setMetaTags([...metaTags, { name: "", content: "" }])
  }

  const copySitemapUrl = async () => {
    try {
      if (!sitemapUrl) return
      await navigator.clipboard.writeText(sitemapUrl)
      setSuccess("Copied")
    } catch {
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SEO Tools</h1>
        <p className="text-muted-foreground">Optimize your website for search engines</p>
      </div>

      {isLoading ? <div className="text-muted-foreground">Loading...</div> : null}
      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="rounded-lg border border-border bg-muted p-4 text-sm">{success}</div> : null}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General SEO</TabsTrigger>
          <TabsTrigger value="meta-tags">Meta Tags</TabsTrigger>
          <TabsTrigger value="sitemap">Sitemap</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="tools">SEO Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic SEO Settings</CardTitle>
              <CardDescription>
                Configure essential SEO settings for your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site-title">Site Title</Label>
                <Input
                  id="site-title"
                  value={seoSettings.siteTitle}
                  onChange={(e) => setSeoSettings({ ...seoSettings, siteTitle: e.target.value })}
                  placeholder="Your Website Title"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 50-60 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site-description">Site Description</Label>
                <Textarea
                  id="site-description"
                  value={seoSettings.siteDescription}
                  onChange={(e) => setSeoSettings({ ...seoSettings, siteDescription: e.target.value })}
                  placeholder="Brief description of your website"
                  maxLength={160}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 150-160 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords</Label>
                <Input
                  id="keywords"
                  value={seoSettings.keywords}
                  onChange={(e) => setSeoSettings({ ...seoSettings, keywords: e.target.value })}
                  placeholder="keyword1, keyword2, keyword3"
                />
                <p className="text-xs text-muted-foreground">
                  Separate keywords with commas
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="og-image">OG Image URL</Label>
                  <Input
                    id="og-image"
                    value={seoSettings.ogImage}
                    onChange={(e) => setSeoSettings({ ...seoSettings, ogImage: e.target.value })}
                    placeholder="https://example.com/og-image.jpg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter-handle">Twitter Handle</Label>
                  <Input
                    id="twitter-handle"
                    value={seoSettings.twitterHandle}
                    onChange={(e) => setSeoSettings({ ...seoSettings, twitterHandle: e.target.value })}
                    placeholder="@yourhandle"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-sitemap"
                    checked={seoSettings.enableSitemap}
                    onCheckedChange={(checked) => setSeoSettings({ ...seoSettings, enableSitemap: checked })}
                  />
                  <Label htmlFor="enable-sitemap">Enable Sitemap</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-robots"
                    checked={seoSettings.enableRobots}
                    onCheckedChange={(checked) => setSeoSettings({ ...seoSettings, enableRobots: checked })}
                  />
                  <Label htmlFor="enable-robots">Enable Robots.txt</Label>
                </div>
              </div>

              <Button className="w-full md:w-auto" onClick={saveSeoSettings} disabled={isLoading}>
                <Globe className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save SEO Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta-tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meta Tags Management</CardTitle>
              <CardDescription>
                Configure meta tags for better SEO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metaTags.map((tag, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meta Name</Label>
                    <Input
                      value={tag.name}
                      onChange={(e) => {
                        const newTags = [...metaTags]
                        newTags[index].name = e.target.value
                        setMetaTags(newTags)
                      }}
                      placeholder="meta name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meta Content</Label>
                    <Input
                      value={tag.content}
                      onChange={(e) => {
                        const newTags = [...metaTags]
                        newTags[index].content = e.target.value
                        setMetaTags(newTags)
                      }}
                      placeholder="meta content"
                    />
                  </div>
                </div>
              ))}

              <Button variant="outline" className="w-full" onClick={addMetaTag}>
                Add Meta Tag
              </Button>

              <Button className="w-full md:w-auto" onClick={saveSeoSettings} disabled={isLoading}>
                <Globe className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sitemap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sitemap Management</CardTitle>
              <CardDescription>
                Generate and manage XML sitemaps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">XML Sitemap</h4>
                  <p className="text-sm text-muted-foreground">
                    Last generated: {sitemapLastGeneratedAt ? new Date(sitemapLastGeneratedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button size="sm" onClick={generateSitemap} disabled={isLoading || !seoSettings.enableSitemap}>
                    Generate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sitemap URL</Label>
                <div className="flex gap-2">
                  <Input value={sitemapUrl} readOnly />
                  <Button variant="outline" size="sm" onClick={copySitemapUrl} disabled={!sitemapUrl}>
                    Copy
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                Sitemap generation and download are not implemented yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Integration</CardTitle>
              <CardDescription>
                Connect Google Analytics and other tracking tools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-analytics">Google Analytics ID</Label>
                <Input
                  id="google-analytics"
                  value={seoSettings.googleAnalytics}
                  onChange={(e) => setSeoSettings({ ...seoSettings, googleAnalytics: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your Google Analytics 4 measurement ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="google-tag-manager">Google Tag Manager ID</Label>
                <Input
                  id="google-tag-manager"
                  value={seoSettings.googleTagManager}
                  onChange={(e) => setSeoSettings({ ...seoSettings, googleTagManager: e.target.value })}
                  placeholder="GTM-XXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your Google Tag Manager container ID
                </p>
              </div>

              <Button className="w-full md:w-auto" onClick={saveSeoSettings} disabled={isLoading}>
                <BarChart3 className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Analytics Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO Tools</CardTitle>
              <CardDescription>
                Additional tools to improve your SEO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Page Speed Test</CardTitle>
                    <CardDescription>
                      Test your website loading speed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">
                      <Search className="mr-2 h-4 w-4" />
                      Run Test
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Meta Preview</CardTitle>
                    <CardDescription>
                      See how your page appears in search results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      Preview
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Keyword Density</CardTitle>
                    <CardDescription>
                      Analyze keyword density on your pages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      Analyze
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Image Alt Text</CardTitle>
                    <CardDescription>
                      Check and optimize image alt texts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      Check Images
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
