#!/bin/bash
# Run these commands from the project root directory (C:\Users\fraz1\Desktop\multi-master)
# to push the complete project to GitHub

# Step 1: Initialize Git (if not already initialized)
git init

# Step 2: Add all files (respects .gitignore — .env, node_modules, vendor, etc. excluded)
git add .

# Step 3: Check what will be committed
git status

# Step 4: Commit
git commit -m "Initial commit: Sell1Mall multi-vendor marketplace
- Next.js 16 frontend with TypeScript and Tailwind CSS v4
- PHP backend API with MySQL database
- Real-time WebSocket chat (Ratchet)
- Admin panel with staff/roles/permissions
- Customer dashboard, seller dashboard
- Product management, order management
- Wallet system, withdrawals, deposits"

# Step 5: Add remote origin
git remote add origin https://github.com/frazdev-png/multi-master.git

# Step 6: Push to GitHub (main branch)
git branch -M main
git push -u origin main
