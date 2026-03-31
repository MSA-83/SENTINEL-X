module.exports = {
  apps: [
    {
      name: 'sentinel-x',
      script: 'npm',
      args: 'run preview -- --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        OTX_KEY: process.env.OTX_KEY,
        OPENSKY_USERNAME: process.env.OPENSKY_USERNAME,
        OPENSKY_PASSWORD: process.env.OPENSKY_PASSWORD,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
