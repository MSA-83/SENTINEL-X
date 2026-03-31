import { Hono } from 'hono'

const chat = new Hono()

chat.post('/api/chat', async (c) => {
  const { message } = await c.req.json()

  if (!message) {
    return c.json({ error: 'Message required' }, 400)
  }

  try {
    // Run LLM on the edge using Workers AI
    const response = await c.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct', // fast & free model
      {
        prompt: `You are Sentinel AI, a global situational awareness analyst.
Current time: ${new Date().toISOString()}

User query: ${message}

Analyze the situation using real-time OSINT knowledge. Be concise, professional, and actionable.
If relevant, reference aviation, maritime, orbital, environmental, cyber, or geopolitical domains.

Response:`,
        max_tokens: 512,
        temperature: 0.7,
      }
    )

    return c.json({ reply: response })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: 'AI service unavailable' }, 500)
  }
})

export default chat
