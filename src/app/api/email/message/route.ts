import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const address = searchParams.get('address')
    const password = searchParams.get('password')

    if (!messageId || !address || !password) {
      return NextResponse.json({ error: 'messageId, address and password are required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Authenticate with mail.tm
    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    })

    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Auth failed' }, { status: 401 })
    }

    const tokenData = await tokenRes.json()
    const token = tokenData.token

    // Fetch single message from mail.tm
    const msgRes = await fetch(`https://api.mail.tm/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    if (!msgRes.ok) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const msg = await msgRes.json()

    await logUsage(sessionHash, 'read_message')

    return NextResponse.json({
      success: true,
      message: {
        id: msg.id,
        fromAddress: msg.from?.address || 'unknown@unknown.com',
        fromName: msg.from?.name || null,
        to: msg.to?.map((t: any) => t.address) || [],
        subject: msg.subject || '(Sin asunto)',
        intro: msg.intro || '',
        bodyText: msg.text || null,
        bodyHtml: msg.html?.[0] || null,
        isRead: true,
        receivedAt: msg.createdAt,
        attachments: msg.attachments || [],
      },
      remaining: rateCheck.remaining - 1,
    })
  } catch (error) {
    console.error('Error fetching message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const address = searchParams.get('address')
    const password = searchParams.get('password')

    if (!messageId || !address || !password) {
      return NextResponse.json({ error: 'messageId, address and password are required' }, { status: 400 })
    }

    // Authenticate with mail.tm
    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    })

    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Auth failed' }, { status: 401 })
    }

    const tokenData = await tokenRes.json()
    const token = tokenData.token

    // Delete message from mail.tm
    const deleteRes = await fetch(`https://api.mail.tm/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!deleteRes.ok) {
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
