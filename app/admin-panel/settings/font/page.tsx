"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Type, Download, Upload } from "lucide-react"
import { useEffect, useState } from "react"

export default function FontSettingsPage() {
  const [fontSettings, setFontSettings] = useState({
    primaryFont: "",
    secondaryFont: "",
    headingFont: "",
    bodyFontSize: "",
    headingFontSize: "",
  })

  const [customFonts, setCustomFonts] = useState<Array<{ name: string; family: string; url: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

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
        const fs = data?.data?.font_settings || {}
        if (cancelled) return
        setFontSettings({
          primaryFont: fs.primaryFont || "Inter",
          secondaryFont: fs.secondaryFont || "Roboto",
          headingFont: fs.headingFont || "Poppins",
          bodyFontSize: fs.bodyFontSize || "16",
          headingFontSize: fs.headingFontSize || "24",
        })
        setCustomFonts(Array.isArray(fs.customFonts) ? fs.customFonts : [])
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

  const save = async () => {
    try {
      setIsLoading(true)
      setError("")
      setSuccess("")
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          font_settings: {
            ...fontSettings,
            customFonts,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Font Options</h1>
        <p className="text-muted-foreground">Configure typography settings for your website</p>
      </div>

      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="rounded-lg border border-border bg-muted p-4 text-sm">{success}</div> : null}

      <Tabs defaultValue="system-fonts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system-fonts">System Fonts</TabsTrigger>
          <TabsTrigger value="custom-fonts">Custom Fonts</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="system-fonts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Font Configuration</CardTitle>
              <CardDescription>
                Select fonts for different elements on your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-font">Primary Font</Label>
                  <Select value={fontSettings.primaryFont} onValueChange={(value) => setFontSettings({ ...fontSettings, primaryFont: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary font" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Montserrat">Montserrat</SelectItem>
                      <SelectItem value="Poppins">Poppins</SelectItem>
                      <SelectItem value="Raleway">Raleway</SelectItem>
                      <SelectItem value="Ubuntu">Ubuntu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-font">Secondary Font</Label>
                  <Select value={fontSettings.secondaryFont} onValueChange={(value) => setFontSettings({ ...fontSettings, secondaryFont: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select secondary font" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Montserrat">Montserrat</SelectItem>
                      <SelectItem value="Poppins">Poppins</SelectItem>
                      <SelectItem value="Raleway">Raleway</SelectItem>
                      <SelectItem value="Ubuntu">Ubuntu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heading-font">Heading Font</Label>
                  <Select value={fontSettings.headingFont} onValueChange={(value) => setFontSettings({ ...fontSettings, headingFont: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select heading font" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Montserrat">Montserrat</SelectItem>
                      <SelectItem value="Poppins">Poppins</SelectItem>
                      <SelectItem value="Raleway">Raleway</SelectItem>
                      <SelectItem value="Ubuntu">Ubuntu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body-font-size">Body Font Size (px)</Label>
                  <Input
                    id="body-font-size"
                    type="number"
                    value={fontSettings.bodyFontSize}
                    onChange={(e) => setFontSettings({ ...fontSettings, bodyFontSize: e.target.value })}
                    placeholder="16"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="heading-font-size">Heading Font Size (px)</Label>
                <Input
                  id="heading-font-size"
                  type="number"
                  value={fontSettings.headingFontSize}
                  onChange={(e) => setFontSettings({ ...fontSettings, headingFontSize: e.target.value })}
                  placeholder="24"
                />
              </div>

              <Button className="w-full md:w-auto" onClick={save} disabled={isLoading}>
                <Type className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Font Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-fonts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Fonts</CardTitle>
              <CardDescription>
                Upload and manage custom fonts for your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {customFonts.map((font, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Font Name</Label>
                          <Input
                            value={font.name}
                            onChange={(e) => {
                              const newFonts = [...customFonts]
                              newFonts[index].name = e.target.value
                              setCustomFonts(newFonts)
                            }}
                            placeholder="Font name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Font Family</Label>
                          <Input
                            value={font.family}
                            onChange={(e) => {
                              const newFonts = [...customFonts]
                              newFonts[index].family = e.target.value
                              setCustomFonts(newFonts)
                            }}
                            placeholder="Font family"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Font File URL</Label>
                          <div className="flex gap-2">
                            <Input
                              value={font.url}
                              onChange={(e) => {
                                const newFonts = [...customFonts]
                                newFonts[index].url = e.target.value
                                setCustomFonts(newFonts)
                              }}
                              placeholder="Font file URL"
                            />
                            <Button variant="outline" size="sm">
                              <Upload className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button variant="outline" className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Add Custom Font
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Font Preview</CardTitle>
              <CardDescription>
                Preview how your font settings will look on the website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: fontSettings.headingFont }}>
                  Heading Text Sample
                </h1>
                <p className="text-lg" style={{ fontFamily: fontSettings.primaryFont }}>
                  This is a sample text using the primary font configuration.
                </p>
                <p className="text-base" style={{ fontFamily: fontSettings.secondaryFont }}>
                  This is a sample text using the secondary font configuration.
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="text-2xl font-semibold mb-3">Typography Scale</h3>
                <div className="space-y-2" style={{ fontFamily: fontSettings.primaryFont }}>
                  <h1 className="text-4xl">H1 Heading (4xl)</h1>
                  <h2 className="text-3xl">H2 Heading (3xl)</h2>
                  <h3 className="text-2xl">H3 Heading (2xl)</h3>
                  <h4 className="text-xl">H4 Heading (xl)</h4>
                  <h5 className="text-lg">H5 Heading (lg)</h5>
                  <h6 className="text-base">H6 Heading (base)</h6>
                  <p className="text-sm">Small text (sm)</p>
                  <p className="text-xs">Extra small text (xs)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
