import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMessage, deleteMessage } from '@/lib/mailtm'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Get from local DB first
    let message = await db.emailMessage.findUnique({ where: { id: messageId } })
    
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // If message doesn't have full body, fetch from mail.tm
    if (!message.bodyText && !message.bodyHtml && message.mailTmMsgId) {
      const account = await db.emailAccount.findUnique({ where: { id: message.accountId } })
      if (account) {
        const fullMsg = await getMessage(account.emailAddress, account.password, message.mailTmMsgId)
        if (fullMsg) {
          message = await db.emailMessage.update({
            where: { id: messageId },
            data: {
              bodyText: fullMsg.text || null,
              bodyHtml: fullMsg.html?.[0] || null,
              isRead: true,
            },
          })
        }
      }
    } else {
      // Mark as read
      await db.emailMessage.update({
        where: { id: messageId },
        data: { isRead: true },
      })
    }

    await logUsage(sessionHash, 'read_message')

    return NextResponse.json({
      success: true,
      message,
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

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }

    const message = await db.emailMessage.findUnique({ where: { id: messageId } })
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Delete from mail.tm if we have the ID
    if (message.mailTmMsgId) {
      const account = await db.emailAccount.findUnique({ where: { id: message.accountId } })
      if (account) {
        await deleteMessage(account.emailAddress, account.password, message.mailTmMsgId)
      }
    }

    // Delete from local DB
    await db.emailMessage.delete({ where: { id: messageId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
