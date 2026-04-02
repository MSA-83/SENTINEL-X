/**
 * SENTINEL OS — PM2 Configuration
 *
 * All secrets are read from .dev.vars (Wrangler) or environment variables.
 * NEVER hardcode API keys here.
 *
 * To set local secrets, create .dev.vars in project root:
 *   NASA_FIRMS_KEY=your_key_here
 *   OWM_KEY=your_key_here
 *   ... etc
 *
 * For production, use: wrangler pages secret put KEY_NAME
 */
module.exports = {
  apps: [
    {
      name: 'sentinel-os',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
