# Troubleshooting Guide

This comprehensive troubleshooting guide helps you resolve common issues with MOIDVK installation, configuration, and usage.

## 🎯 Overview

This guide covers troubleshooting for:
- Installation issues
- MCP integration problems
- Tool-specific issues
- Performance problems
- Security issues
- Network and connectivity problems
- Platform-specific issues

## 🔍 Quick Diagnosis

### Health Check Commands

```bash
# Check MOIDVK installation
moidvk --version

# Check server status
moidvk serve --test

# Check tool availability
moidvk list-tools

# Check configuration
moidvk config --validate
```

### Common Error Patterns

| Error Pattern | Likely Cause | Solution |
|---------------|--------------|----------|
| `Command not found` | Installation issue | Reinstall MOIDVK |
| `Permission denied` | File permissions | Fix file permissions |
| `Connection refused` | Server not running | Start MCP server |
| `Timeout` | Performance issue | Check system resources |
| `Validation error` | Configuration issue | Validate configuration |

## 🚀 Installation Issues

### "Command not found: moidvk"

**Symptoms**: Terminal reports command not found

**Diagnosis**:
```bash
# Check if moidvk is installed
which moidvk

# Check PATH environment
echo $PATH

# Check if bun is available
which bun
```

**Solutions**:

#### Solution 1: Reinstall Globally
```bash
# Uninstall existing installation
bun uninstall -g moidvk

# Reinstall globally
bun install -g moidvk

# Verify installation
moidvk --version
```

#### Solution 2: Fix PATH Issues
```bash
# Add bun to PATH (add to ~/.bashrc, ~/.zshrc, or ~/.profile)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc
```

#### Solution 3: Manual Installation
```bash
# Clone repository
git clone https://github.com/your-org/moidvk.git
cd moidvk

# Install dependencies
bun install

# Create global link
bun link

# Verify installation
moidvk --help
```

### "Permission denied" Errors

**Symptoms**: Permission errors during installation or execution

**Diagnosis**:
```bash
# Check file permissions
ls -la $(which moidvk)

# Check directory permissions
ls -la /opt/moidvk/

# Check user permissions
whoami
groups
```

**Solutions**:

#### Solution 1: Fix File Permissions
```bash
# Fix executable permissions
chmod +x $(which moidvk)

# Fix directory permissions
sudo chown -R $USER:$USER /opt/moidvk/
chmod 755 /opt/moidvk/
```

#### Solution 2: Install with Correct Permissions
```bash
# Install with proper ownership
sudo bun install -g moidvk
sudo chown -R $USER:$USER ~/.bun/

# Or install locally
bun install moidvk
```

### Dependency Installation Issues

**Symptoms**: Errors during `bun install`

**Diagnosis**:
```bash
# Check bun version
bun --version

# Check Node.js version
node --version

# Check available memory
free -h

# Check disk space
df -h
```

**Solutions**:

#### Solution 1: Update Dependencies
```bash
# Update bun
curl -fsSL https://bun.sh/install | bash

# Update Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clear cache and reinstall
bun pm cache rm
bun install
```

#### Solution 2: Fix Memory Issues
```bash
# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 🔧 MCP Integration Issues

### "MCP server connection failed"

**Symptoms**: MCP client can't connect to MOIDVK server

**Diagnosis**:
```bash
# Check if server is running
ps aux | grep moidvk

# Check server logs
moidvk serve --debug

# Check port availability
netstat -tlnp | grep 3000
```

**Solutions**:

#### Solution 1: Start Server Manually
```bash
# Start server in foreground
moidvk serve

# Start with debug mode
moidvk serve --debug

# Start on specific port
moidvk serve --port 3001
```

#### Solution 2: Fix Configuration
```json
// Claude Desktop configuration
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

#### Solution 3: Check Network Issues
```bash
# Test local connectivity
curl http://localhost:3000/health

# Check firewall
sudo ufw status

# Test port availability
telnet localhost 3000
```

### "Tool not available" Errors

**Symptoms**: Specific tools not showing up in MCP client

**Diagnosis**:
```bash
# Check available tools
moidvk list-tools

# Check server logs
moidvk serve --verbose

# Test individual tools
moidvk check-code --help
```

**Solutions**:

#### Solution 1: Restart MCP Client
```bash
# Restart Claude Desktop
# Restart Cursor
# Restart VS Code
```

#### Solution 2: Check Tool Registration
```bash
# Verify tool installation
moidvk install-tools

# Check tool dependencies
moidvk check-dependencies
```

#### Solution 3: Update Tools
```bash
# Update all tools
moidvk update-tools

# Update specific tool
moidvk update-tool check-code-practices
```

## 🛠️ Tool-Specific Issues

### Code Quality Tool Issues

#### "ESLint configuration error"

**Symptoms**: ESLint-related errors in code quality checks

**Solutions**:
```bash
# Check ESLint configuration
moidvk check-config eslint

# Create default ESLint config
moidvk init-eslint

# Use custom ESLint config
moidvk check-code -f app.js --eslint-config .eslintrc.json
```

#### "Prettier formatting error"

**Symptoms**: Prettier-related errors in code formatting

**Solutions**:
```bash
# Check Prettier configuration
moidvk check-config prettier

# Create default Prettier config
moidvk init-prettier

# Use custom Prettier config
moidvk format -f app.js --prettier-config .prettierrc
```

### Security Tool Issues

#### "Vulnerability scan failed"

**Symptoms**: Security vulnerability scanning errors

**Solutions**:
```bash
# Check npm/bun installation
npm --version
bun --version

# Clear package manager cache
npm cache clean --force
bun pm cache rm

# Check network connectivity
ping registry.npmjs.org

# Use alternative registry
moidvk scan-security --registry https://registry.npmjs.org/
```

#### "Production readiness check error"

**Symptoms**: Production readiness analysis failures

**Solutions**:
```bash
# Check file permissions
ls -la src/

# Check file encoding
file src/app.js

# Use verbose mode
moidvk check-production -f src/app.js --verbose
```

### Accessibility Tool Issues

#### "Puppeteer installation error"

**Symptoms**: Accessibility testing fails due to Puppeteer issues

**Solutions**:
```bash
# Install system dependencies
sudo apt-get install -y \
  gconf-service \
  libasound2 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  ca-certificates \
  fonts-liberation \
  libappindicator1 \
  libnss3 \
  lsb-release \
  xdg-utils \
  wget

# Reinstall Puppeteer
npm uninstall puppeteer
npm install puppeteer
```

#### "Accessibility test timeout"

**Symptoms**: Accessibility tests timeout or hang

**Solutions**:
```bash
# Increase timeout
moidvk check-accessibility -f page.html --timeout 60000

# Use headless mode
moidvk check-accessibility -f page.html --headless

# Skip contrast checking
moidvk check-accessibility -f page.html --no-contrast
```

### GraphQL Tool Issues

#### "GraphQL schema validation error"

**Symptoms**: GraphQL schema validation failures

**Solutions**:
```bash
# Check GraphQL syntax
moidvk validate-graphql-syntax schema.graphql

# Use specific GraphQL version
moidvk check-graphql-schema -f schema.graphql --version 2021

# Check schema introspection
moidvk introspect-schema schema.graphql
```

#### "GraphQL query analysis error"

**Symptoms**: GraphQL query analysis failures

**Solutions**:
```bash
# Check query syntax
moidvk validate-graphql-query query.graphql

# Use schema validation
moidvk check-graphql-query -f query.graphql --schema schema.graphql

# Increase complexity limits
moidvk check-graphql-query -f query.graphql --max-complexity 200
```

### Redux Tool Issues

#### "Redux pattern detection error"

**Symptoms**: Redux pattern analysis failures

**Solutions**:
```bash
# Specify code type
moidvk check-redux -f store.js --code-type store

# Use strict mode
moidvk check-redux -f reducer.js --strict

# Check Redux Toolkit detection
moidvk check-redux -f slice.js --toolkit
```

## ⚡ Performance Issues

### Slow Tool Execution

**Symptoms**: Tools take too long to execute

**Diagnosis**:
```bash
# Check system resources
top
free -h
df -h

# Check tool performance
moidvk benchmark

# Check memory usage
ps aux | grep moidvk
```

**Solutions**:

#### Solution 1: Optimize System Resources
```bash
# Increase available memory
sudo sysctl vm.swappiness=10

# Optimize disk I/O
sudo ionice -c 2 -n 7 -p $$

# Use SSD storage
# Move MOIDVK to SSD if possible
```

#### Solution 2: Configure Tool Limits
```bash
# Limit file size
moidvk check-code -f app.js --max-size 1048576

# Use pagination
moidvk check-code -f app.js --limit 10 --offset 0

# Enable caching
moidvk check-code -f app.js --cache
```

#### Solution 3: Parallel Processing
```bash
# Process multiple files in parallel
find . -name "*.js" | xargs -P 4 -I {} moidvk check-code -f {}
```

### Memory Issues

**Symptoms**: Out of memory errors or high memory usage

**Solutions**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Increase Bun memory limit
export BUN_OPTIONS="--max-old-space-size=4096"

# Monitor memory usage
watch -n 1 'free -h && ps aux | grep moidvk'
```

### CPU Issues

**Symptoms**: High CPU usage or slow processing

**Solutions**:
```bash
# Check CPU usage
top -p $(pgrep -f moidvk)

# Optimize processing
moidvk check-code -f app.js --optimize

# Use background processing
moidvk check-code -f app.js --background
```

## 🔒 Security Issues

### Permission Errors

**Symptoms**: Security-related permission errors

**Solutions**:
```bash
# Check file permissions
ls -la /opt/moidvk/

# Fix ownership
sudo chown -R moidvk:moidvk /opt/moidvk/

# Fix permissions
sudo chmod 755 /opt/moidvk/
sudo chmod 600 /opt/moidvk/.env
```

### Consent Violations

**Symptoms**: Explicit consent requirement errors

**Solutions**:
```bash
# Check consent configuration
moidvk config --show consent

# Enable auto-consent for development
moidvk config --set consent.auto_consent.enabled true

# Check consent levels
moidvk config --show consent.levels
```

### Path Security Issues

**Symptoms**: Path traversal or workspace boundary errors

**Solutions**:
```bash
# Check workspace configuration
moidvk config --show workspace

# Set workspace root
moidvk config --set workspace.root /path/to/workspace

# Check allowed paths
moidvk config --show workspace.allowed_paths
```

## 🌐 Network and Connectivity Issues

### Proxy Issues

**Symptoms**: Network requests fail through proxy

**Solutions**:
```bash
# Configure proxy
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Use proxy in configuration
moidvk config --set network.proxy.enabled true
moidvk config --set network.proxy.url http://proxy.company.com:8080
```

### Firewall Issues

**Symptoms**: Network connections blocked

**Solutions**:
```bash
# Check firewall status
sudo ufw status

# Allow MOIDVK ports
sudo ufw allow 3000
sudo ufw allow 9090

# Check iptables
sudo iptables -L
```

### DNS Issues

**Symptoms**: Domain resolution failures

**Solutions**:
```bash
# Check DNS resolution
nslookup registry.npmjs.org

# Use alternative DNS
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf

# Check network connectivity
ping -c 4 registry.npmjs.org
```

## 💻 Platform-Specific Issues

### macOS Issues

#### "Homebrew installation problems"

**Solutions**:
```bash
# Update Homebrew
brew update

# Fix Homebrew permissions
sudo chown -R $(whoami) /usr/local/bin /usr/local/lib /usr/local/sbin
chmod u+w /usr/local/bin /usr/local/lib /usr/local/sbin

# Reinstall bun
brew uninstall bun
brew install bun
```

#### "Permission denied on macOS"

**Solutions**:
```bash
# Fix Gatekeeper issues
sudo spctl --master-disable

# Fix file permissions
sudo chown -R $(whoami) /opt/moidvk/

# Check SIP status
csrutil status
```

### Windows Issues

#### "PowerShell execution policy"

**Solutions**:
```powershell
# Set execution policy
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run as administrator if needed
Start-Process PowerShell -Verb RunAs
```

#### "Path length limitations"

**Solutions**:
```powershell
# Enable long paths
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

# Use shorter installation path
# Install MOIDVK in C:\moidvk instead of deep paths
```

### Linux Issues

#### "Systemd service issues"

**Solutions**:
```bash
# Check service status
sudo systemctl status moidvk

# View service logs
sudo journalctl -u moidvk -f

# Restart service
sudo systemctl restart moidvk

# Enable service
sudo systemctl enable moidvk
```

#### "SELinux issues"

**Solutions**:
```bash
# Check SELinux status
sestatus

# Set SELinux context
sudo semanage fcontext -a -t bin_t "/opt/moidvk/bin(/.*)?"
sudo restorecon -Rv /opt/moidvk/

# Or disable SELinux temporarily
sudo setenforce 0
```

## 🔧 Debugging Techniques

### Enable Debug Mode

```bash
# Enable debug logging
DEBUG=true moidvk serve

# Enable verbose output
moidvk serve --verbose

# Enable trace logging
moidvk serve --trace
```

### Log Analysis

```bash
# View application logs
tail -f /opt/moidvk/logs/app.log

# View error logs
tail -f /opt/moidvk/logs/error.log

# View security logs
tail -f /opt/moidvk/logs/security.log

# Search logs for errors
grep -i "error" /opt/moidvk/logs/*.log
```

### Performance Profiling

```bash
# Profile Node.js application
node --prof /opt/moidvk/server.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect /opt/moidvk/server.js
```

### Network Debugging

```bash
# Check network connections
netstat -tlnp | grep moidvk

# Monitor network traffic
tcpdump -i lo port 3000

# Test connectivity
curl -v http://localhost:3000/health
```

## 📞 Getting Help

### Self-Service Resources

1. **Documentation**: Check the [main documentation](README.md)
2. **FAQ**: Review common questions and answers
3. **Search**: Search existing issues and discussions
4. **Community**: Check community forums and discussions

### Contact Support

#### Before Contacting Support

1. **Gather Information**:
   - MOIDVK version: `moidvk --version`
   - System information: `uname -a`
   - Error logs: Copy relevant log entries
   - Steps to reproduce: Document exact steps

2. **Check Known Issues**:
   - Search GitHub issues
   - Check release notes
   - Review changelog

3. **Try Basic Troubleshooting**:
   - Restart services
   - Clear caches
   - Update to latest version

#### Support Channels

- **GitHub Issues**: [Repository Issues](https://github.com/your-org/moidvk/issues)
- **Documentation**: [Documentation Site](https://docs.moidvk.com)
- **Email Support**: support@moidvk.com
- **Emergency Contact**: emergency@moidvk.com

#### Information to Provide

When contacting support, include:

```bash
# System information
moidvk --version
uname -a
node --version
bun --version

# Configuration
moidvk config --show

# Error logs
tail -n 50 /opt/moidvk/logs/error.log

# Steps to reproduce
# 1. What you were trying to do
# 2. What command you ran
# 3. What error you received
# 4. What you expected to happen
```

### Community Support

- **GitHub Discussions**: Community discussions and Q&A
- **Stack Overflow**: Tag questions with `moidvk`
- **Reddit**: r/moidvk community
- **Discord**: Community chat and support

## 📚 Additional Resources

### Troubleshooting Tools

- **MOIDVK Doctor**: `moidvk doctor` - Comprehensive system check
- **Configuration Validator**: `moidvk config --validate`
- **Dependency Checker**: `moidvk check-dependencies`
- **Performance Monitor**: `moidvk monitor`

### External Tools

- **System Monitor**: `htop`, `iotop`, `nethogs`
- **Network Tools**: `tcpdump`, `wireshark`, `curl`
- **Process Tools**: `strace`, `ltrace`, `gdb`
- **Log Analysis**: `grep`, `awk`, `sed`

---

**Troubleshooting Complete!** 🔧 This guide should help you resolve most issues with MOIDVK. If you're still experiencing problems, contact support with the information requested above.