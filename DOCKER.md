# Docker Deployment Guide - Ross Built CMS

This guide covers containerized deployment of Ross Built Construction Management Software.

## Quick Start

### Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- `.env` file configured with required variables

### Build and Run

```bash
# Build the Docker image
npm run docker:build

# Start the application
npm run docker:run

# Or use docker-compose directly
docker-compose up -d
```

The application will be available at `http://localhost:3001`

## Configuration

### Required Environment Variables

Create a `.env` file in the project root with:

```env
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# API Keys (Required)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional
SUPABASE_ACCESS_TOKEN=your-access-token
PORT=3001
```

### Port Configuration

The default port is 3001. To change it:

```bash
# Using environment variable
PORT=8080 docker-compose up -d

# Or in docker-compose.yml
ports:
  - "8080:3001"
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run docker:build` | Build Docker image |
| `npm run docker:run` | Start with docker-compose |
| `npm run docker:dev` | Start in development mode |
| `docker-compose down` | Stop containers |
| `docker-compose logs -f` | View logs |
| `docker-compose ps` | Check status |

## Architecture

### Multi-Stage Build

The Dockerfile uses a 3-stage build for optimization:

1. **frontend-builder**: Builds React app with Vite
2. **server-builder**: Installs Node.js dependencies with native modules
3. **production**: Minimal runtime image

### Image Details

- Base: `node:20-alpine`
- Size: ~250MB (optimized)
- Security: Non-root user (`rossbuilt`)
- Process manager: `dumb-init` for signal handling

## Development Mode

For development with hot reload:

```bash
# Start development containers
npm run docker:dev

# Or directly
docker-compose -f docker-compose.dev.yml up

# Debug mode available on port 9229
```

Development features:
- Source code mounted as volumes
- Node.js inspector enabled (port 9229)
- Verbose logging

### Debugging

Connect VS Code debugger:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Docker: Attach",
  "port": 9229,
  "remoteRoot": "/app"
}
```

## Optional Services

### Redis Cache

Enable Redis for caching (future use):

```bash
# Start with Redis
docker-compose --profile with-redis up -d

# Or in development
docker-compose -f docker-compose.dev.yml --profile with-redis up
```

Redis will be available at `localhost:6379`.

## Health Checks

The container includes health checks that verify:

- Server is responding
- Database connectivity
- Storage connectivity

Check health status:

```bash
# View container health
docker inspect --format='{{.State.Health.Status}}' rossbuilt-cms

# View health check logs
docker inspect --format='{{json .State.Health}}' rossbuilt-cms | jq
```

Health endpoint: `GET /api/health`

## Volumes

Persistent data is stored in Docker volumes:

| Volume | Purpose |
|--------|---------|
| `rossbuilt-uploads` | Uploaded files |
| `rossbuilt-logs` | Application logs |
| `rossbuilt-redis` | Redis data (if enabled) |

### Backup Volumes

```bash
# Backup uploads
docker run --rm -v rossbuilt-uploads:/data -v $(pwd):/backup alpine \
  tar cvf /backup/uploads-backup.tar /data

# Restore uploads
docker run --rm -v rossbuilt-uploads:/data -v $(pwd):/backup alpine \
  tar xvf /backup/uploads-backup.tar -C /
```

## Production Deployment

### Recommended Settings

```yaml
# docker-compose.prod.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
```

### Security Checklist

- [ ] Use secrets management for API keys
- [ ] Enable HTTPS via reverse proxy (nginx/traefik)
- [ ] Limit network exposure
- [ ] Regularly update base images
- [ ] Scan images for vulnerabilities

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name cms.rossbuilt.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Common issues:
# - Missing environment variables
# - Port already in use
# - Insufficient memory
```

### Build fails on native modules

Native modules (canvas, sharp) require build tools:

```bash
# If building locally fails, ensure you have:
# - Python 3
# - GCC/Make
# - Cairo development libraries
```

### Connection refused

1. Check container is running: `docker-compose ps`
2. Verify health: `docker inspect rossbuilt-cms`
3. Check port mapping: `docker port rossbuilt-cms`

### Clear everything and rebuild

```bash
# Stop containers
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

## Performance Tuning

### Node.js Memory

For large uploads/processing:

```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=4096
```

### Container Resources

```yaml
deploy:
  resources:
    limits:
      memory: 4G
```

## SSL/HTTPS Setup

### Option 1: Let's Encrypt with Certbot (Recommended)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d cms.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal: sudo certbot renew --dry-run
```

### Option 2: Traefik Reverse Proxy (Docker-native)

```yaml
# docker-compose.prod.yml with Traefik
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=your@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "traefik-certificates:/letsencrypt"
    networks:
      - rossbuilt-network

  app:
    image: rossbuilt-cms:latest
    container_name: rossbuilt-cms
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`cms.yourdomain.com`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.services.app.loadbalancer.server.port=3001"
    networks:
      - rossbuilt-network
    # ... rest of app config
```

### Domain Configuration

1. **DNS Setup**: Point your domain to your server's IP address
   ```
   A Record: cms.yourdomain.com -> YOUR_SERVER_IP
   ```

2. **Update Environment Variables**:
   ```env
   APP_URL=https://cms.yourdomain.com
   QBO_REDIRECT_URI=https://cms.yourdomain.com/api/quickbooks/callback
   XERO_REDIRECT_URI=https://cms.yourdomain.com/api/xero/callback
   ```

3. **Update OAuth Redirect URIs**: Update in QuickBooks Developer Portal and Xero Developer Portal

## Production Deployment Checklist

### Before Deployment

- [ ] **Environment Variables**: All required variables set in `.env`
- [ ] **Database**: Supabase project configured and migrations run
- [ ] **DNS**: Domain pointed to server IP
- [ ] **SSL Certificate**: Let's Encrypt or custom certificate ready
- [ ] **Firewall**: Ports 80, 443 open; 3001 closed to public

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (keep secret!) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI features |
| `APP_URL` | Yes | Public URL (https://...) |
| `STRIPE_SECRET_KEY` | Billing | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Billing | Stripe webhook secret |
| `QBO_CLIENT_ID` | QuickBooks | QuickBooks OAuth client |
| `XERO_CLIENT_ID` | Xero | Xero OAuth client |

### After Deployment

- [ ] **Health Check**: Visit `/api/health` - should return `{ "status": "ok" }`
- [ ] **Login Test**: Test authentication flow
- [ ] **File Upload**: Test PDF upload and AI processing
- [ ] **Integrations**: Test QuickBooks/Xero OAuth flow
- [ ] **Mobile**: Test PWA installation on mobile device
- [ ] **Monitoring**: Set up uptime monitoring (e.g., UptimeRobot, Pingdom)
- [ ] **Backups**: Configure automated database backups in Supabase

### Monitoring & Alerting

```bash
# View real-time logs
docker-compose logs -f app

# Check container health
docker inspect rossbuilt-cms | jq '.[0].State.Health'

# Check resource usage
docker stats rossbuilt-cms
```

### Recommended: Set up log aggregation with:
- **Grafana Loki** for log search
- **Prometheus + Grafana** for metrics
- **Sentry** for error tracking

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t rossbuilt-cms:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag rossbuilt-cms:${{ github.sha }} your-registry/rossbuilt-cms:latest
          docker push your-registry/rossbuilt-cms:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/rossbuilt-cms
            docker-compose pull app
            docker-compose up -d app
            docker image prune -f
```

### Rollback

```bash
# View available image tags
docker images rossbuilt-cms

# Rollback to previous version
docker-compose down
docker tag rossbuilt-cms:previous rossbuilt-cms:latest
docker-compose up -d
```
