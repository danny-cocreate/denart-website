# DenArt Website - Deployment Documentation

## Overview
The DenArt website is built with Astro and deployed to Hostinger using GitHub Actions.

## Tech Stack
- **Framework**: Astro (static site generation)
- **Hosting**: Hostinger (shared hosting with SSH access)
- **CI/CD**: GitHub Actions
- **Domain**: denartny.com

## Deployment Flow

```
Local Push → GitHub → GitHub Actions → Build → rsync → Hostinger
```

### Trigger
- **Automatic**: Every push to `main` branch
- **Manual**: GitHub → Actions → "Deploy to Hostinger" → "Run workflow"

### What Happens
1. GitHub Actions checks out the code
2. Installs Node.js dependencies
3. Builds Astro static site (`npm run build`)
4. rsyncs `dist/` folder to Hostinger via SSH

## Files
- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `astro.config.mjs` - Astro configuration (static output)

## SSH Access
- **Host**: 88.223.84.106
- **Port**: 65002
- **User**: u335557094
- **Key**: ~/.ssh/id_rsa_gh (local) / GitHub Secrets

## GitHub Secrets
Stored in repo Settings → Secrets and variables → Actions:
- `HOSTINGER_SSH_KEY` - Private SSH key
- `HOSTINGER_HOST` - Server IP (88.223.84.106)
- `HOSTINGER_USER` - SSH username (u335557094)
- `HOSTINGER_PORT` - SSH port (65002)
- `HOSTINGER_REMOTE_PATH` - `/home/u335557094/domains/denartny.com/public_html`

## DNS Configuration
- **A record** (@) → 88.223.84.106
- **CNAME** (www) → optional

### Troubleshooting DNS
If site doesn't load after DNS change:
1. Clear local DNS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
2. Use external DNS (8.8.8.8) temporarily
3. Wait for propagation (usually within hours)

## .htaccess
Located in public_html, configured for:
- Static file serving
- HTTPS redirect
- SPA fallback (serves index.html for unknown routes)

## Common Issues

### SSH Key Not Working
- Regenerate key: `ssh-keygen -t rsa -b 4096 -C "github-actions@denart" -N "" -f ~/.ssh/id_rsa_gh`
- Add public key to Hostinger SSH Access panel
- Update `HOSTINGER_SSH_KEY` secret in GitHub

### Deployment Fails
- Check GitHub Actions logs for errors
- Verify secrets are correct
- Check Hostinger firewall isn't blocking GitHub IPs

### Site Shows Old Content
- Clear browser cache
- Check .htaccess is correct (not WordPress)
- Verify rsync deployed new files: `ssh -i ~/.ssh/id_rsa_gh -p 65002 u335557094@88.223.84.106 "ls -la /home/u335557094/domains/denartny.com/public_html/index.html"`

## Making Changes

### Local Development
```bash
cd /Users/cocreatebot/projects/denart-website
npm run dev
```

### Deploy Changes
```bash
git add .
git commit -m "Description of changes"
git push origin main
```

Then watch deployment in GitHub Actions tab.
