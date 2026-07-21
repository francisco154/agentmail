import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMessages } from '@/lib/mailtm'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', message: 'Límite excedido. Intenta de nuevo más tarde.', resetAt: rateCheck.resetAt },
        { status: 429 }
      )
    }

    // Get account from DB
    const account = await db.emailAccount.findUnique({ where: { id: accountId } })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Fetch messages from mail.tm
    const messages = await getMessages(account.emailAddress, account.password)

    // Update last checked
    await db.emailAccount.update({
      where: { id: accountId },
      data: { lastCheckedAt: new Date() },
    })

    // Save messages to local DB (upsert)
    for (const msg of messages) {
      const existing = await db.emailMessage.findFirst({ where: { mailTmMsgId: msg.id } })
      if (!existing) {
        await db.emailMessage.create({
          data: {
            accountId: account.id,
            mailTmMsgId: msg.id,
            fromAddress: msg.from?.address || 'unknown@unknown.com',
            fromName: msg.from?.name || null,
            subject: msg.subject || '(Sin asunto)',
            bodyText: msg.text || null,
            bodyHtml: msg.html?.[0] || null,
            isRead: msg.seen || false,
            receivedAt: new Date(msg.createdAt),
          },
        })
      }
    }

    await logUsage(sessionHash, 'check_inbox')

    // Return messages from DB for consistency
    const dbMessages = await db.emailMessage.findMany({
      where: { accountId },
      orderBy: { receivedAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      messages: dbMessages,
      remaining: rateCheck.remaining - 1,
    })
  } catch (error) {
    console.error('Error fetching inbox:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
