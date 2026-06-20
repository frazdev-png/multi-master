import crypto from "crypto"

// Admin credentials (demo purposes - store in env in production)
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || "admin@sarcstore.com",
  password: process.env.ADMIN_PASSWORD || "Admin@123456",
}

export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + process.env.ADMIN_PASSWORD_SALT || "sar-store-salt")
    .digest("hex")
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function validateAdminCredentials(email: string, password: string): boolean {
  return email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password
}

export function validateSellerPromoCode(code: string): boolean {
  // Validate 4-digit promo code format
  return /^\d{4}$/.test(code)
}

export function validateSellerRegistration(data: {
  username: string
  email: string
  storeName: string
  mobileNumber: string
  promoCode: string
  password: string
  confirmPassword: string
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.username || data.username.trim().length < 3) {
    errors.push("Username must be at least 3 characters")
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Valid email is required")
  }

  if (!data.storeName || data.storeName.trim().length < 3) {
    errors.push("Store name must be at least 3 characters")
  }

  if (!data.mobileNumber || !/^[\d+\-\s()]{10,}$/.test(data.mobileNumber)) {
    errors.push("Valid mobile number is required")
  }

  if (!validateSellerPromoCode(data.promoCode)) {
    errors.push("Promo code must be 4 digits")
  }

  if (!data.password || data.password.length < 8) {
    errors.push("Password must be at least 8 characters")
  }

  if (data.password !== data.confirmPassword) {
    errors.push("Passwords do not match")
  }

  return { valid: errors.length === 0, errors }
}
