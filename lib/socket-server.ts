import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'

export const config = {
  api: {
    bodyParser: false,
  },
}

let io: ServerIO | null = null
let currentSettings: any = null

const fetchSettingsFromAPI = async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settings`)
    const result = await response.json()
    if (result.success && result.data) {
      currentSettings = result.data
      return result.data
    }
  } catch (error) {
    console.error('Error fetching settings:', error)
  }
  return null
}

const updateSettingsInAPI = async (settings: any) => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings)
    })
    const result = await response.json()
    if (result.success) {
      currentSettings = result.data
      return result.data
    }
  } catch (error) {
    console.error('Error updating settings:', error)
  }
  return null
}

const SocketHandler = async (req: NextApiRequest, res: NextApiResponse & { socket: any }) => {
  if (!io) {
    console.log('Initializing Socket.IO server...')
    const httpServer: NetServer = res.socket.server as any
    io = new ServerIO(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })

    // Load initial settings
    await fetchSettingsFromAPI()

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Send current settings to new client
      if (currentSettings) {
        socket.emit('settings-update', currentSettings)
      }

      // Handle admin settings changes
      socket.on('admin-settings-change', async (newSettings) => {
        console.log('Admin settings change received:', newSettings)
        
        // Update in API
        const updatedSettings = await updateSettingsInAPI(newSettings)
        
        if (updatedSettings) {
          // Broadcast to all clients
          io!.emit('settings-update', updatedSettings)
          console.log('Settings broadcasted to all clients')
        } else {
          socket.emit('error', { message: 'Failed to update settings' })
        }
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })

    res.socket.server.io = io
    console.log('Socket.IO server initialized')
  } else {
    console.log('Socket.IO server already running')
  }
  
  res.end()
}

export default SocketHandler
