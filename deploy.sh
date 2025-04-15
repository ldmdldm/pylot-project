#!/bin/bash

# Exit on error
set -e

# Load environment variables
source .env

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting deployment process...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Ensure we're authenticated and using the correct project
echo -e "${GREEN}Authenticating with Google Cloud...${NC}"
gcloud auth login --quiet
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
gcloud services enable \
    appengine.googleapis.com \
    cloudbuild.googleapis.com \
    cloudscheduler.googleapis.com \
    bigquery.googleapis.com \
    storage.googleapis.com

# Create a new version of the app
echo -e "${GREEN}Deploying backend to App Engine...${NC}"
gcloud app deploy app.yaml --quiet

# Deploy frontend to Cloud Storage
echo -e "${GREEN}Building and deploying frontend...${NC}"
cd frontend
npm install
npm run build
gsutil -m rsync -r build gs://$GCS_BUCKET/frontend

# Set up Cloud CDN and Load Balancer
echo -e "${GREEN}Setting up Cloud CDN...${NC}"
gcloud compute backend-buckets create frontend-bucket \
    --gcs-bucket-name=$GCS_BUCKET \
    --enable-cdn

# Create HTTPS load balancer
gcloud compute url-maps create web-map \
    --default-backend-bucket=frontend-bucket

# Create SSL certificate
gcloud compute ssl-certificates create web-cert \
    --domains=app.pyusd-intent-system.cloud.goog

# Create HTTPS proxy
gcloud compute target-https-proxies create web-https-proxy \
    --url-map=web-map \
    --ssl-certificates=web-cert

# Create forwarding rule
gcloud compute forwarding-rules create web-forwarding-rule \
    --target-https-proxy=web-https-proxy \
    --global \
    --ports=443

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "Backend URL: https://api.pyusd-intent-system.cloud.goog"
echo -e "Frontend URL: https://app.pyusd-intent-system.cloud.goog" 