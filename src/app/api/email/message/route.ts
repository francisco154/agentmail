import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

const GUERRILLA_API = 'https://api.guerrillamail.com/ajax.php'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const provider = searchParams.get('provider') || 'guerrillamail'
    const sidToken = searchParams.get('sidToken') || ''
    const address = searchParams.get('address') || ''
    const password = searchParams.get('password') || ''

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    let message: any = null

    if (provider === 'guerrillamail') {
      if (!sidToken) {
        return NextResponse.json({ error: 'sidToken required' }, { status: 400 })
      }

      // Fetch full email from Guerrilla Mail
      const fetchRes = await fetch(`${GUERRILLA_API}?f=fetch_email&sid_token=${sidToken}&email_id=${messageId}`, {
        signal: AbortSignal.timeout(15000),
      })

      if (!fetchRes.ok) {
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
      }

      const fetchData = await fetchRes.json()

      message = {
        id: String(fetchData.mail_id),
        fromAddress: fetchData.mail_from || 'unknown',
        fromName: fetchData.mail_from || null,
        subject: fetchData.mail_subject || '(Sin asunto)',
        bodyText: fetchData.mail_body || null,
        bodyHtml: fetchData.mail_body ? null : null, // Guerrilla returns body as HTML in mail_body
        isRead: true,
        receivedAt: fetchData.mail_date || new Date().toISOString(),
      }

      // If the body looks like HTML, put it in bodyHtml
      if (message.bodyText && (message.bodyText.includes('<html') || message.bodyText.includes('<div') || message.bodyText.includes('<p>'))) {
        message.bodyHtml = message.bodyText
        message.bodyText = null
      }

    } else if (provider === 'mailtm') {
      if (!address || !password) {
        return NextResponse.json({ error: 'address and password required' }, { status: 400 })
      }

      const tokenRes = await fetch('https://api.mail.tm/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
        signal: AbortSignal.timeout(10000),
      })

      if (!tokenRes.ok) {
        return NextResponse.json({ error: 'Auth failed' }, { status: 401 })
      }

      const tokenData = await tokenRes.json()
      const token = tokenData.token

      const msgRes = await fetch(`https://api.mail.tm/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!msgRes.ok) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      }

      const msg = await msgRes.json()

      message = {
        id: msg.id,
        fromAddress: msg.from?.address || 'unknown',
        fromName: msg.from?.name || null,
        subject: msg.subject || '(Sin asunto)',
        bodyText: msg.text || null,
        bodyHtml: msg.html?.[0] || null,
        isRead: true,
        receivedAt: msg.createdAt,
      }
    }

    await logUsage(sessionHash, 'read_message')

    return NextResponse.json({
      success: true,
      message,
      remaining: rateCheck.remaining - 1,
    })
  } catch (error: any) {
    console.error('Error fetching message:', error)
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const provider = searchParams.get('provider') || 'guerrillamail'
    const sidToken = searchParams.get('sidToken') || ''

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 })
    }

    if (provider === 'guerrillamail' && sidToken) {
      await fetch(`${GUERRILLA_API}?f=delete_email&sid_token=${sidToken}&email_id=${messageId}`, {
        signal: AbortSignal.timeout(10000),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
