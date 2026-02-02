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

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Docker Image

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
          docker tag rossbuilt-cms:${{ github.sha }} registry.example.com/rossbuilt-cms:latest
          docker push registry.example.com/rossbuilt-cms:latest
```
