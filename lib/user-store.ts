 // Shared user store for authentication demo
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface User {
  email: string
  password: string
  role: "customer" | "seller"
  fullName: string
  storeName?: string
  username?: string
  mobileNumber?: string
  promoCode?: string
  verificationStatus?: "pending" | "approved" | "rejected"
  isVerified: boolean
  createdAt: string
}

// File path for persistent storage
const USERS_FILE = join(process.cwd(), 'users.json')

// Initialize users from file or use defaults
function getUsersFromFile(): Map<string, User> {
  try {
    if (existsSync(USERS_FILE)) {
      const data = readFileSync(USERS_FILE, 'utf-8')
      const usersData = JSON.parse(data)
      return new Map(Object.entries(usersData))
    }
  } catch (error) {
    console.log('[v0] Could not read users file, using defaults')
  }

  return new Map<string, User>()
}

// Save users to file
function saveUsersToFile(users: Map<string, User>) {
  try {
    const usersData = Object.fromEntries(users)
    writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2))
  } catch (error) {
    console.log('[v0] Could not save users file:', error)
  }
}

// Get current users
export function getUsers(): Map<string, User> {
  return getUsersFromFile()
}

export function createUser(userData: Omit<User, 'createdAt' | 'isVerified'>): User {
  const users = getUsers()
  const user: User = {
    ...userData,
    isVerified: userData.role === "customer", // Customers are auto-verified
    createdAt: new Date().toISOString()
  }
  
  users.set(userData.email, user)
  saveUsersToFile(users)
  console.log(`[v0] User created: ${user.email}, role: ${user.role}`)
  return user
}

export function getUserByEmail(email: string): User | undefined {
  const users = getUsers()
  return users.get(email)
}

export function verifyUser(email: string, password: string): User | null {
  const users = getUsers()
  const user = users.get(email)
  if (!user || user.password !== password) {
    console.log(`[v0] Login failed for: ${email}`)
    return null
  }
  console.log(`[v0] Login successful: ${user.email}, role: ${user.role}`)
  return user
}

// Debug function to list all users
export function listAllUsers(): User[] {
  const users = getUsers()
  return Array.from(users.values())
}
