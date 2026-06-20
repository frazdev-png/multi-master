export type UserRole = "customer" | "seller" | "admin"
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "frozen"
export type ProductStatus = "active" | "inactive" | "frozen"
export type MessageType = "text" | "image" | "file"

export interface User {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
  bio: string | null
  address: string | null
  is_verified: boolean
  is_frozen: boolean
  created_at: string
  updated_at: string
}

export interface Seller {
  id: string
  user_id: string
  business_name: string
  business_description: string | null
  business_logo_url: string | null
  total_sales: number
  average_rating: number
  is_verified: boolean
  is_frozen: boolean
  freeze_reason: string | null
  created_at: string
}

export interface Product {
  id: string
  seller_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  stock_quantity: number
  image_urls: string[]
  status: ProductStatus
  rating: number
  total_reviews: number
  created_at: string
}

export interface Order {
  id: string
  customer_id: string
  seller_id: string
  order_number: string
  status: OrderStatus
  total_amount: number
  shipping_address: string | null
  tracking_number: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string | null
  message_type: MessageType
  file_url: string | null
  is_read: boolean
  created_at: string
}

export interface Conversation {
  id: string
  participant_1_id: string
  participant_2_id: string
  last_message_id: string | null
  last_message_at: string
}
