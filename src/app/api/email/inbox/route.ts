import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

const GUERRILLA_API = 'https://api.guerrillamail.com/ajax.php'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') || 'guerrillamail'
    const sidToken = searchParams.get('sidToken') || ''
    const seq = searchParams.get('seq') || '0'
    const address = searchParams.get('address') || ''
    const password = searchParams.get('password') || ''

    if (provider === 'guerrillamail' && !sidToken) {
      return NextResponse.json({ error: 'sidToken required for guerrillamail' }, { status: 400 })
    }
    if (provider === 'mailtm' && (!address || !password)) {
      return NextResponse.json({ error: 'address and password required for mailtm' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', message: 'Límite excedido.' },
        { status: 429 }
      )
    }

    let messages: any[] = []

    if (provider === 'guerrillamail') {
      // Check email via Guerrilla Mail API
      const checkRes = await fetch(`${GUERRILLA_API}?f=check_email&sid_token=${sidToken}&seq=${seq}`, {
        signal: AbortSignal.timeout(15000),
      })

      if (!checkRes.ok) {
        return NextResponse.json({ error: 'Check failed', message: 'Error al verificar la bandeja.' }, { status: 500 })
      }

      const checkData = await checkRes.json()
      const list = checkData.list || []

      messages = list.map((msg: any) => ({
        id: String(msg.mail_id),
        fromAddress: msg.mail_from || 'unknown',
        fromName: msg.mail_from || null,
        subject: msg.mail_subject || '(Sin asunto)',
        intro: msg.mail_excerpt || '',
        isRead: msg.mail_read === '1',
        receivedAt: msg.mail_date || new Date().toISOString(),
        provider: 'guerrillamail',
      }))

    } else if (provider === 'mailtm') {
      // Check email via mail.tm API
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

      const messagesRes = await fetch('https://api.mail.tm/messages', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!messagesRes.ok) {
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
      }

      const messagesData = await messagesRes.json()
      const rawMessages = Array.isArray(messagesData) ? messagesData : (messagesData['hydra:member'] || [])

      messages = rawMessages.map((msg: any) => ({
        id: msg.id,
        fromAddress: msg.from?.address || 'unknown@unknown.com',
        fromName: msg.from?.name || null,
        subject: msg.subject || '(Sin asunto)',
        intro: msg.intro || '',
        isRead: msg.seen || false,
        receivedAt: msg.createdAt,
        provider: 'mailtm',
      }))
    }

    await logUsage(sessionHash, 'check_inbox')

    return NextResponse.json({
      success: true,
      messages,
      remaining: rateCheck.remaining - 1,
    })
  } catch (error: any) {
    console.error('Error fetching inbox:', error)
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
  }
}
