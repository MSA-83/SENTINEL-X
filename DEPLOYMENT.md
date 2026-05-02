# SENTINEL-X Deployment Guide

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/MSA-83/SENTINEL-X.git
cd SENTINEL-X
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

### 3. Run Locally
```bash
npm install
npm run dev
```

### 4. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `GROQ_API_KEY` | No | Groq API key for AI |
| `JWT_SECRET` | Yes | Auth secret (generate new) |
| `AWS_ACCESS_KEY_ID` | No | S3 access for files |
| `AWS_SECRET_ACCESS_KEY` | No | S3 secret for files |

## Database Setup

### Option 1: Supabase (Recommended)
1. Create project at https://supabase.com
2. Go to Settings → API
3. Copy URL and anon key
4. Run schema in SQL Editor

### Option 2: PostgreSQL
```bash
docker-compose up -d postgres
psql -h localhost -U sentinel -d sentinel -f db/schema.sql
```

## Features

### Command Center
- Real-time threat map
- Live intelligence feed
- Split/map/feed views

### Case Management
- Create/assign cases
- Link threats
- Timeline tracking
- Audit logs

### Entity Resolution
- Track aircraft/vessels
- Risk scoring
- Activity history

### Analytics
- Threat statistics
- Activity timelines
- Hotspot analysis
- System status

### AI Assistant
- Groq-powered chat
- Threat analysis
- Pattern detection

### Search
- Full-text search
- Type/severity filters
- Quick actions

## Troubleshooting

### Build Errors
```bash
# Clear cache
npm run build -- --force

# Check TypeScript
npm run typecheck
```

### Database Connection
```bash
# Check Supabase status
supabase status

# View logs
supabase logs
```

### API Errors
Check Vercel function logs in dashboard.

## Support

- Discord: https://discord.gg/sentinel-x
- Email: support@sentinel-x.ai
- GitHub: https://github.com/MSA-83/SENTINEL-X/issues