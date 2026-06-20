-- Add seller verification fields to sellers table
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS id_front_image_url TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS id_back_image_url TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending'; -- pending, verified, rejected
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS promo_code VARCHAR(10);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS verification_rejected_reason TEXT;

-- Create admin credentials table for admin panel authentication
CREATE TABLE IF NOT EXISTS admin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin', -- admin, super_admin
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create promo codes table for seller verification
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_by_seller_id UUID REFERENCES sellers(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_credentials_email ON admin_credentials(email);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_sellers_username ON sellers(username);
