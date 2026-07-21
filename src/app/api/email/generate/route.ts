import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createTempAccount } from '@/lib/mailtm'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionHash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16)

    const rateCheck = await checkRateLimit(sessionHash)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          message: `Has alcanzado el límite de ${1000} acciones cada 16 días. Tu límite se reinicia el ${rateCheck.resetAt.toLocaleDateString()}.`,
          resetAt: rateCheck.resetAt 
        },
        { status: 429 }
      )
    }

    const account = await createTempAccount()
    if (!account) {
      return NextResponse.json(
        { error: 'Failed to create email account', message: 'No se pudo crear la cuenta de email temporal. Inténtalo de nuevo.' },
        { status: 500 }
      )
    }

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    const emailAccount = await db.emailAccount.create({
      data: {
        emailAddress: account.address,
        password: account.password,
        mailTmId: account.id,
        expiresAt,
      },
    })

    await logUsage(sessionHash, 'generate_email')

    return NextResponse.json({
      success: true,
      account: {
        id: emailAccount.id,
        address: emailAccount.emailAddress,
        expiresAt: emailAccount.expiresAt,
        remaining: rateCheck.remaining - 1,
      },
    })
  } catch (error) {
    console.error('Error generating email:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
