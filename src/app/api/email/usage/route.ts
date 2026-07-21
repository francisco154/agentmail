import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)

    return NextResponse.json({
      success: true,
      allowed: rateCheck.allowed,
      remaining: rateCheck.remaining,
      maxPerPeriod: 1000,
      periodDays: 16,
      resetAt: rateCheck.resetAt,
    })
  } catch (error) {
    console.error('Error checking usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
