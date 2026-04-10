import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.json({
    name: 'SENTINEL-X',
    status: 'operational',
    timestamp: new Date().toISOString()
  })
})

app.get('/intel/feed', (c) => {
  return c.json({
    feeds: [],
    message: 'Fusion engine placeholder'
  })
})

export default app
