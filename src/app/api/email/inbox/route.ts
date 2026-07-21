import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const password = searchParams.get('password')

    if (!address || !password) {
      return NextResponse.json({ error: 'address and password are required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', message: 'Límite excedido.', resetAt: rateCheck.resetAt },
        { status: 429 }
      )
    }

    // Authenticate with mail.tm
    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    })

    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Auth failed', message: 'No se pudo autenticar con el servicio de email.' }, { status: 401 })
    }

    const tokenData = await tokenRes.json()
    const token = tokenData.token

    // Fetch messages from mail.tm
    const messagesRes = await fetch('https://api.mail.tm/messages', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    if (!messagesRes.ok) {
      return NextResponse.json({ error: 'Fetch failed', message: 'No se pudo obtener la bandeja.' }, { status: 500 })
    }

    const messagesData = await messagesRes.json()
    const rawMessages = Array.isArray(messagesData) ? messagesData : (messagesData['hydra:member'] || [])

    // Format messages for the frontend
    const messages = rawMessages.map((msg: any) => ({
      id: msg.id,
      fromAddress: msg.from?.address || 'unknown@unknown.com',
      fromName: msg.from?.name || null,
      subject: msg.subject || '(Sin asunto)',
      intro: msg.intro || '',
      isRead: msg.seen || false,
      receivedAt: msg.createdAt,
    }))

    await logUsage(sessionHash, 'check_inbox')

    return NextResponse.json({
      success: true,
      messages,
      remaining: rateCheck.remaining - 1,
    })
  } catch (error) {
    console.error('Error fetching inbox:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
