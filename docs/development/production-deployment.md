# Production Deployment Guide

This guide covers everything you need to know about deploying MOIDVK in production environments, including security configuration, monitoring, and maintenance.

## 🎯 Overview

Production deployment of MOIDVK requires careful planning to ensure security, performance, and reliability. This guide provides comprehensive instructions for enterprise-grade deployment.

## 📋 Prerequisites

Before deploying to production, ensure you have:

- **Production Environment**: Linux server with Node.js 18+ and Bun 1.0+
- **Security Requirements**: Firewall, SSL certificates, secure network
- **Monitoring Tools**: Log aggregation, metrics collection, alerting
- **Backup Strategy**: Data backup and recovery procedures
- **Documentation**: Deployment procedures and runbooks

## 🚀 Production Installation

### Step 1: Server Preparation

#### System Requirements

```bash
# Minimum system requirements
CPU: 2 cores
RAM: 4GB (8GB recommended)
Storage: 20GB SSD
OS: Ubuntu 20.04+ or CentOS 8+

# Check system resources
free -h
df -h
nproc
```

#### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Verify installations
node --version
bun --version
```

### Step 2: MOIDVK Installation

#### Install MOIDVK

```bash
# Create application directory
sudo mkdir -p /opt/moidvk
sudo chown $USER:$USER /opt/moidvk
cd /opt/moidvk

# Clone repository
git clone https://github.com/your-org/moidvk.git .
git checkout v1.0.0  # Use specific version

# Install dependencies
bun install --production

# Create global link
sudo bun link
```

#### Verify Installation

```bash
# Test installation
moidvk --version

# Test server
moidvk serve --env production

# Test tools
echo "const x = 1" | moidvk check-code
```

### Step 3: Configuration

#### Environment Configuration

Create `/opt/moidvk/.env`:

```bash
# Production environment
NODE_ENV=production
DEBUG=false
LOG_LEVEL=info

# Security settings
SECURITY_LEVEL=strict
EXPLICIT_CONSENT=true
ALLOWED_ORIGINS=https://your-domain.com

# Performance settings
MAX_FILE_SIZE=10485760  # 10MB
TIMEOUT=30000
MAX_CONCURRENT_REQUESTS=10

# Filesystem settings
WORKSPACE_ROOT=/opt/moidvk/workspaces
EMBEDDING_CACHE_DIR=/opt/moidvk/cache
MODEL_CACHE_DIR=/opt/moidvk/models

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

#### Global Configuration

Create `/opt/moidvk/config/production.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "timeout": 30000,
    "maxPayload": "10mb"
  },
  "security": {
    "level": "strict",
    "explicitConsent": true,
    "allowedOrigins": ["https://your-domain.com"],
    "rateLimit": {
      "windowMs": 15 * 60 * 1000,
      "max": 100
    }
  },
  "tools": {
    "check_code_practices": {
      "production": true,
      "strict": true,
      "limit": 100
    },
    "format_code": {
      "check_only": false
    },
    "scan_security_vulnerabilities": {
      "severity": "low",
      "production_only": true
    }
  },
  "filesystem": {
    "workspaceRoot": "/opt/moidvk/workspaces",
    "maxFileSize": 10485760,
    "allowedExtensions": [".js", ".ts", ".jsx", ".tsx", ".json", ".md"],
    "blockedPatterns": ["**/node_modules/**", "**/.git/**", "**/*.env*"]
  },
  "monitoring": {
    "enabled": true,
    "metricsPort": 9090,
    "healthCheckPath": "/health"
  }
}
```

## 🔐 Security Configuration

### Network Security

#### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow MOIDVK port
sudo ufw allow 3000

# Allow metrics port (if enabled)
sudo ufw allow 9090

# Check status
sudo ufw status
```

#### SSL/TLS Configuration

```bash
# Install Certbot
sudo apt install certbot

# Obtain SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure Nginx with SSL
sudo nano /etc/nginx/sites-available/moidvk
```

Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Application Security

#### User and Permissions

```bash
# Create dedicated user
sudo useradd -r -s /bin/false moidvk

# Set ownership
sudo chown -R moidvk:moidvk /opt/moidvk

# Set proper permissions
sudo chmod 755 /opt/moidvk
sudo chmod 600 /opt/moidvk/.env
sudo chmod 644 /opt/moidvk/config/production.json
```

#### Security Hardening

```bash
# Disable unnecessary services
sudo systemctl disable snapd
sudo systemctl disable cloud-init

# Configure system limits
echo "moidvk soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "moidvk hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 🚀 Service Setup

### Systemd Service

Create `/etc/systemd/system/moidvk.service`:

```ini
[Unit]
Description=MOIDVK Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=moidvk
Group=moidvk
WorkingDirectory=/opt/moidvk
Environment=NODE_ENV=production
Environment=PATH=/opt/moidvk/node_modules/.bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/bun run serve
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=moidvk

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/moidvk/workspaces /opt/moidvk/cache /opt/moidvk/logs

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

### Service Management

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable moidvk
sudo systemctl start moidvk

# Check status
sudo systemctl status moidvk

# View logs
sudo journalctl -u moidvk -f
```

### Health Check

Create `/opt/moidvk/health-check.sh`:

```bash
#!/bin/bash
# Health check script

HEALTH_URL="http://localhost:3000/health"
TIMEOUT=10

# Check if service is responding
if curl -f --max-time $TIMEOUT $HEALTH_URL > /dev/null 2>&1; then
    echo "OK: MOIDVK service is healthy"
    exit 0
else
    echo "ERROR: MOIDVK service is not responding"
    exit 1
fi
```

Make executable:

```bash
chmod +x /opt/moidvk/health-check.sh
```

## 📊 Monitoring and Logging

### Log Configuration

Create `/opt/moidvk/config/logging.json`:

```json
{
  "level": "info",
  "format": "json",
  "transports": [
    {
      "type": "file",
      "filename": "/opt/moidvk/logs/app.log",
      "maxsize": "10m",
      "maxfiles": "5"
    },
    {
      "type": "file",
      "filename": "/opt/moidvk/logs/error.log",
      "level": "error",
      "maxsize": "10m",
      "maxfiles": "5"
    }
  ]
}
```

### Metrics Collection

#### Prometheus Configuration

Create `/etc/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'moidvk'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

#### Grafana Dashboard

Create dashboard configuration for monitoring:
- Request rate
- Response times
- Error rates
- Resource usage
- Tool usage statistics

### Alerting

#### Alert Rules

Create `/etc/prometheus/rules/moidvk.rules`:

```yaml
groups:
  - name: moidvk
    rules:
      - alert: MOIDVKDown
        expr: up{job="moidvk"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MOIDVK server is down"
          description: "MOIDVK server has been down for more than 1 minute"

      - alert: HighErrorRate
        expr: rate(http_requests_total{job="moidvk", status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 10% for 2 minutes"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="moidvk"}[5m])) > 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is above 5 seconds"
```

## 💾 Backup and Recovery

### Backup Strategy

#### Data Backup

Create `/opt/moidvk/scripts/backup.sh`:

```bash
#!/bin/bash
# Backup script

BACKUP_DIR="/opt/backups/moidvk"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="moidvk-backup-$DATE.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application data
tar -czf $BACKUP_DIR/$BACKUP_FILE \
  /opt/moidvk/config \
  /opt/moidvk/workspaces \
  /opt/moidvk/cache \
  /opt/moidvk/logs

# Keep only last 7 days of backups
find $BACKUP_DIR -name "moidvk-backup-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

#### Configuration Backup

```bash
# Backup configuration files
sudo cp /opt/moidvk/config/production.json /opt/backups/config/
sudo cp /etc/systemd/system/moidvk.service /opt/backups/config/
sudo cp /etc/nginx/sites-available/moidvk /opt/backups/config/
```

### Recovery Procedures

#### Application Recovery

```bash
#!/bin/bash
# Recovery script

BACKUP_FILE=$1
RESTORE_DIR="/opt/moidvk-restore"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

# Stop service
sudo systemctl stop moidvk

# Extract backup
tar -xzf $BACKUP_FILE -C $RESTORE_DIR

# Restore data
sudo cp -r $RESTORE_DIR/opt/moidvk/* /opt/moidvk/

# Fix permissions
sudo chown -R moidvk:moidvk /opt/moidvk

# Start service
sudo systemctl start moidvk

echo "Recovery completed"
```

## 🔧 Performance Optimization

### Resource Optimization

#### Memory Management

```bash
# Configure Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=4096"

# Configure Bun memory limits
export BUN_OPTIONS="--max-old-space-size=4096"
```

#### Process Management

```bash
# Use PM2 for process management
npm install -g pm2

# Create PM2 configuration
cat > /opt/moidvk/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'moidvk',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '1G',
    error_file: '/opt/moidvk/logs/err.log',
    out_file: '/opt/moidvk/logs/out.log',
    log_file: '/opt/moidvk/logs/combined.log',
    time: true
  }]
}
EOF
```

### Caching Strategy

#### Embedding Cache

```bash
# Configure embedding cache
mkdir -p /opt/moidvk/cache/embeddings
chown moidvk:moidvk /opt/moidvk/cache/embeddings

# Set cache size limit
echo '{"maxSize": "1GB", "ttl": 86400}' > /opt/moidvk/config/cache.json
```

#### Model Cache

```bash
# Configure model cache
mkdir -p /opt/moidvk/cache/models
chown moidvk:moidvk /opt/moidvk/cache/models

# Pre-download models
moidvk download-models
```

## 🔄 Maintenance Procedures

### Regular Maintenance

#### Daily Tasks

```bash
#!/bin/bash
# Daily maintenance script

# Check service status
systemctl status moidvk

# Check disk space
df -h /opt/moidvk

# Check log files
tail -n 100 /opt/moidvk/logs/app.log

# Run health check
/opt/moidvk/health-check.sh
```

#### Weekly Tasks

```bash
#!/bin/bash
# Weekly maintenance script

# Update system packages
sudo apt update && sudo apt upgrade -y

# Rotate log files
sudo logrotate /etc/logrotate.d/moidvk

# Clean old cache files
find /opt/moidvk/cache -mtime +7 -delete

# Check security vulnerabilities
moidvk scan-security --severity high

# Backup configuration
/opt/moidvk/scripts/backup.sh
```

#### Monthly Tasks

```bash
#!/bin/bash
# Monthly maintenance script

# Review and clean old backups
find /opt/backups -mtime +30 -delete

# Update MOIDVK
cd /opt/moidvk
git pull origin main
bun install --production
sudo systemctl restart moidvk

# Review security logs
grep -i "error\|warning" /opt/moidvk/logs/*.log

# Performance review
# Check metrics and identify bottlenecks
```

### Update Procedures

#### Minor Updates

```bash
#!/bin/bash
# Minor update script

# Stop service
sudo systemctl stop moidvk

# Backup current version
cp -r /opt/moidvk /opt/moidvk-backup-$(date +%Y%m%d)

# Update code
cd /opt/moidvk
git pull origin main

# Update dependencies
bun install --production

# Start service
sudo systemctl start moidvk

# Verify update
/opt/moidvk/health-check.sh
```

#### Major Updates

```bash
#!/bin/bash
# Major update script

# Full backup
/opt/moidvk/scripts/backup.sh

# Stop service
sudo systemctl stop moidvk

# Update system dependencies
sudo apt update && sudo apt upgrade -y

# Update Node.js if needed
# Update Bun if needed

# Fresh installation
cd /opt
sudo rm -rf moidvk
git clone https://github.com/your-org/moidvk.git
cd moidvk
bun install --production

# Restore configuration
cp /opt/backups/config/production.json config/
cp /opt/backups/config/logging.json config/

# Start service
sudo systemctl start moidvk

# Verify update
/opt/moidvk/health-check.sh
```

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check service status
sudo systemctl status moidvk

# Check logs
sudo journalctl -u moidvk -n 50

# Check permissions
ls -la /opt/moidvk

# Check configuration
moidvk --config /opt/moidvk/config/production.json --validate
```

#### High Memory Usage

```bash
# Check memory usage
free -h
ps aux | grep moidvk

# Check for memory leaks
node --inspect /opt/moidvk/server.js

# Restart service
sudo systemctl restart moidvk
```

#### High CPU Usage

```bash
# Check CPU usage
top -p $(pgrep -f moidvk)

# Check for infinite loops
strace -p $(pgrep -f moidvk)

# Profile application
node --prof /opt/moidvk/server.js
```

### Emergency Procedures

#### Emergency Restart

```bash
#!/bin/bash
# Emergency restart script

echo "Emergency restart initiated at $(date)"

# Force stop service
sudo systemctl stop moidvk
sudo pkill -f moidvk

# Wait for processes to stop
sleep 10

# Start service
sudo systemctl start moidvk

# Wait for startup
sleep 30

# Check health
/opt/moidvk/health-check.sh

echo "Emergency restart completed at $(date)"
```

#### Rollback Procedure

```bash
#!/bin/bash
# Rollback script

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

echo "Rolling back to backup: $BACKUP_FILE"

# Stop service
sudo systemctl stop moidvk

# Restore from backup
tar -xzf $BACKUP_FILE -C /tmp/rollback

# Replace current installation
sudo rm -rf /opt/moidvk
sudo mv /tmp/rollback/opt/moidvk /opt/

# Fix permissions
sudo chown -R moidvk:moidvk /opt/moidvk

# Start service
sudo systemctl start moidvk

# Verify rollback
/opt/moidvk/health-check.sh

echo "Rollback completed"
```

## 📚 Best Practices

### Security Best Practices

1. **Regular Updates**: Keep system and application updated
2. **Access Control**: Use dedicated user accounts
3. **Network Security**: Implement proper firewall rules
4. **SSL/TLS**: Always use HTTPS in production
5. **Monitoring**: Monitor for security events

### Performance Best Practices

1. **Resource Monitoring**: Monitor CPU, memory, and disk usage
2. **Caching**: Implement appropriate caching strategies
3. **Load Balancing**: Use load balancers for high availability
4. **Database Optimization**: Optimize database queries
5. **CDN**: Use CDN for static assets

### Operational Best Practices

1. **Documentation**: Maintain up-to-date documentation
2. **Testing**: Test all changes in staging environment
3. **Backup**: Regular backups with tested recovery procedures
4. **Monitoring**: Comprehensive monitoring and alerting
5. **Incident Response**: Have incident response procedures

## 📞 Support

### Getting Help

1. **Documentation**: Check this guide and other documentation
2. **Logs**: Review application and system logs
3. **Community**: Check GitHub issues and discussions
4. **Professional Support**: Contact support team for urgent issues

### Contact Information

- **GitHub Issues**: [Repository Issues](https://github.com/your-org/moidvk/issues)
- **Documentation**: [Documentation Site](https://docs.moidvk.com)
- **Support Email**: support@moidvk.com
- **Emergency Contact**: emergency@moidvk.com

---

**Production Deployment Complete!** 🎉 Your MOIDVK instance is now ready for production use. Remember to monitor performance, maintain security, and keep backups current.