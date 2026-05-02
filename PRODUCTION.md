# SENTINEL-X Production Checklist

## Pre-Deployment

- [ ] **Database Setup**
  - [ ] Create Supabase/Neon project
  - [ ] Run database migrations
  - [ ] Configure RLS policies
  - [ ] Add initial users

- [ ] **Environment Variables**
  - [ ] Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
  - [ ] Set `GROQ_API_KEY` 
  - [ ] Set `JWT_SECRET` (generate new key)
  - [ ] Configure S3/storage (optional)

- [ ] **Vercel/Netlify**
  - [ ] Connect GitHub repository
  - [ ] Set environment variables
  - [ ] Configure build settings

## Security

- [ ] **Authentication**
  - [ ] Enable email verification
  - [ ] Configure password requirements
  - [ ] Set up 2FA (optional)

- [ ] **API Security**
  - [ ] Enable rate limiting
  - [ ] Configure CORS
  - [ ] Set up API keys

- [ ] **Data Security**
  - [ ] Review RLS policies
  - [ ] Audit user permissions
  - [ ] Check for SQL injection

## Post-Deployment

- [ ] **Verification**
  - [ ] Test user registration
  - [ ] Test threat creation
  - [ ] Test alert rules
  - [ ] Test file uploads
  - [ ] Test search
  - [ ] Test AI assistant

- [ ] **Monitoring**
  - [ ] Set up Sentry error tracking
  - [ ] Configure health checks
  - [ ] Set up uptime monitoring

- [ ] **Performance**
  - [ ] Verify page load times
  - [ ] Check API response times
  - [ ] Review bundle size
  - [ ] Optimize images

## Rollback Plan

- [ ] Keep previous deployment
- [ ] Database backup available
- [ ] Rollback script ready