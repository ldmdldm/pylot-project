#!/bin/bash

# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Vercel
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_BACKEND_URL
vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID 