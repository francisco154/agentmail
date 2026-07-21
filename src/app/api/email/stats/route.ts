import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: true,
    stats: {
      service: 'AgentMail',
      version: '1.0',
      provider: 'mail.tm',
      platform: 'Vercel + Supabase',
      rateLimit: '1000 actions / 16 days',
    },
  })
}
