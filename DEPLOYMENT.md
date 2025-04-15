# PYUSD Intent System Deployment Guide

## Prerequisites

1. Install Google Cloud SDK
2. Python 3.9 or higher
3. Node.js 16 or higher
4. Access to Google Cloud Console
5. Domain name configured in Google Cloud DNS

## Initial Setup

1. Install gcloud CLI:
```bash
curl https://sdk.cloud.google.com | bash
gcloud init
```

2. Enable required APIs:
```bash
gcloud services enable \
    appengine.googleapis.com \
    cloudbuild.googleapis.com \
    cloudscheduler.googleapis.com \
    bigquery.googleapis.com \
    storage.googleapis.com
```

3. Set up environment:
```bash
# Copy production environment file
cp .env.production .env
# Generate a secure key
python -c 'import secrets; print(secrets.token_hex(32))' > .env
```

## Backend Deployment

1. Create App Engine application:
```bash
gcloud app create --region=us-central
```

2. Deploy backend:
```bash
gcloud app deploy app.yaml
```

## Frontend Deployment

1. Build frontend:
```bash
cd frontend
npm install
npm run build
```

2. Deploy to Cloud Storage:
```bash
gsutil -m rsync -r build gs://pyusd-intent-system-analytics/frontend
```

## Infrastructure Setup

1. Set up Cloud CDN and Load Balancer:
```bash
# Create backend bucket
gcloud compute backend-buckets create frontend-bucket \
    --gcs-bucket-name=pyusd-intent-system-analytics \
    --enable-cdn

# Create URL map
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
```

## Monitoring Setup

1. Set up Cloud Monitoring:
```bash
gcloud monitoring dashboards create \
    --config-from-file=monitoring/dashboard.json
```

2. Set up alerts:
```bash
gcloud alpha monitoring policies create \
    --config-from-file=monitoring/alerts.json
```

## Automated Deployment

Use the provided `deploy.sh` script for automated deployment:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Verification

1. Check backend health:
```bash
curl https://api.pyusd-intent-system.cloud.goog/health
```

2. Check frontend:
   - Open https://app.pyusd-intent-system.cloud.goog in a browser
   - Verify all features are working
   - Check console for any errors

## Troubleshooting

1. View logs:
```bash
gcloud app logs tail
```

2. Check instance status:
```bash
gcloud app instances list
```

3. Monitor resources:
```bash
gcloud app instances describe [INSTANCE_ID]
```

## Security Considerations

1. Ensure all sensitive data is stored in Secret Manager:
```bash
gcloud secrets create [SECRET_NAME] --data-file=[PATH]
```

2. Update IAM roles as needed:
```bash
gcloud projects add-iam-policy-binding [PROJECT_ID] \
    --member=serviceAccount:[SA_EMAIL] \
    --role=roles/[ROLE_NAME]
```

## Rollback Procedure

To rollback to a previous version:
```bash
gcloud app versions list
gcloud app services set-traffic [SERVICE] --splits [VERSION]=1
``` 