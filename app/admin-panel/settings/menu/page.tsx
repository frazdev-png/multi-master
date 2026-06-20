"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, MoveUp, MoveDown } from "lucide-react"
import { useEffect, useState } from "react"

export default function MenuSettingsPage() {
  const [menuItems, setMenuItems] = useState<Array<{ id: number; name: string; url: string; order: number; active: boolean }>>([])

  const [newItem, setNewItem] = useState({ name: "", url: "", active: true })
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
        const ms = data?.data?.menu_settings || {}
        const list = Array.isArray(ms.menuItems) ? ms.menuItems : []
        if (!cancelled) setMenuItems(list)
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
          menu_settings: {
            menuItems,
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

  const addMenuItem = () => {
    if (newItem.name && newItem.url) {
      setMenuItems([...menuItems, { ...newItem, id: Date.now(), order: menuItems.length + 1 }])
      setNewItem({ name: "", url: "", active: true })
    }
  }

  const deleteMenuItem = (id: number) => {
    setMenuItems(menuItems.filter(item => item.id !== id))
  }

  const toggleMenuItem = (id: number) => {
    setMenuItems(menuItems.map(item => 
      item.id === id ? { ...item, active: !item.active } : item
    ))
  }

  const moveMenuItem = (id: number, direction: 'up' | 'down') => {
    const index = menuItems.findIndex(item => item.id === id)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= menuItems.length) return

    const newItems = [...menuItems]
    ;[newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]]
    
    // Update order numbers
    newItems.forEach((item, idx) => {
      item.order = idx + 1
    })
    
    setMenuItems(newItems)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Menu Settings</h1>
        <p className="text-muted-foreground">Manage your website navigation menu</p>
      </div>

      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="rounded-lg border border-border bg-muted p-4 text-sm">{success}</div> : null}

      <Tabs defaultValue="main-menu" className="space-y-4">
        <TabsList>
          <TabsTrigger value="main-menu">Main Menu</TabsTrigger>
          <TabsTrigger value="footer-menu">Footer Menu</TabsTrigger>
          <TabsTrigger value="mobile-menu">Mobile Menu</TabsTrigger>
        </TabsList>

        <TabsContent value="main-menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Main Navigation Menu</CardTitle>
              <CardDescription>
                Configure the main navigation menu items
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {menuItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex flex-col gap-1 flex-1">
                      <Input
                        value={item.name}
                        onChange={(e) => {
                          setMenuItems(menuItems.map(i => 
                            i.id === item.id ? { ...i, name: e.target.value } : i
                          ))
                        }}
                        placeholder="Menu item name"
                      />
                      <Input
                        value={item.url}
                        onChange={(e) => {
                          setMenuItems(menuItems.map(i => 
                            i.id === item.id ? { ...i, url: e.target.value } : i
                          ))
                        }}
                        placeholder="URL path"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.active}
                        onCheckedChange={() => toggleMenuItem(item.id)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moveMenuItem(item.id, 'up')}
                        disabled={item.order === 1}
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moveMenuItem(item.id, 'down')}
                        disabled={item.order === menuItems.length}
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMenuItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <Button onClick={save} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Menu"}
              </Button>

              <div className="space-y-3">
                <h4 className="font-medium">Add New Menu Item</h4>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <Input
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="Menu item name"
                    />
                    <Input
                      value={newItem.url}
                      onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                      placeholder="URL path"
                    />
                  </div>
                  <Button onClick={addMenuItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer-menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Footer Menu</CardTitle>
              <CardDescription>
                Configure footer navigation links
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Footer menu configuration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mobile-menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Menu</CardTitle>
              <CardDescription>
                Configure mobile-specific menu options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Mobile menu configuration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
