import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'

export const config = {
  api: {
    bodyParser: false,
  },
}

const SocketHandler = (req: NextApiRequest, res: NextApiResponse & { socket: any }) => {
  if (res.socket.server.io) {
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    const httpServer: NetServer = res.socket.server as any
    const io = new ServerIO(httpServer, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })

    // Function to fetch settings from database
    const fetchSettingsFromDB = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/settings`)
        const result = await response.json()
        if (result.success) {
          return result.data
        }
      } catch (error) {
        console.error('Error fetching settings from DB:', error)
      }
      return null
    }

    // Function to update settings in database
    const updateSettingsInDB = async (settings: any) => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/settings/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings)
        })
        const result = await response.json()
        return result.success
      } catch (error) {
        console.error('Error updating settings in DB:', error)
        return false
      }
    }

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Send current settings to newly connected client
      fetchSettingsFromDB().then(settings => {
        if (settings) {
          socket.emit('settings-update', settings)
        }
      })

      // Listen for admin settings changes
      socket.on('admin-settings-change', async (newSettings) => {
        console.log('Settings changed by admin:', newSettings)
        
        // Update database first
        const success = await updateSettingsInDB(newSettings)
        
        if (success) {
          // Fetch updated settings from database
          const updatedSettings = await fetchSettingsFromDB()
          if (updatedSettings) {
            // Broadcast to all connected clients
            io.emit('settings-update', updatedSettings)
          }
        } else {
          socket.emit('error', { message: 'Failed to update settings in database' })
        }
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })

    res.socket.server.io = io
  }
  res.end()
}

export default SocketHandler
