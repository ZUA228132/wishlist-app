// Supabase Edge Function для проверки подписки на канал
// Деплой: supabase functions deploy check-subscription

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') || ''

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { userId, channelId } = await req.json()

    if (!userId || !channelId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or channelId' }),
        { status: 400, headers }
      )
    }

    // Проверяем подписку через Telegram Bot API
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${channelId}&user_id=${userId}`
    )

    const data = await response.json()

    if (!data.ok) {
      return new Response(
        JSON.stringify({ subscribed: false, error: data.description }),
        { headers }
      )
    }

    const status = data.result?.status
    const isSubscribed = ['member', 'administrator', 'creator'].includes(status)

    return new Response(
      JSON.stringify({ 
        subscribed: isSubscribed,
        status: status 
      }),
      { headers }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    )
  }
})