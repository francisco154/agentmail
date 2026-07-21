import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import { createHash } from 'crypto'

export const maxDuration = 30

interface SendEmailRequest {
  to: string
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
  apiKey?: string
}

function getSessionHash(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const ua = request.headers.get('user-agent') || 'unknown'
  return createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 32)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json()
    const { to, subject, html, fromName, fromEmail, replyTo, apiKey } = body

    // Validate required fields
    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, message: 'Faltan campos requeridos: to, subject, html' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(to)) {
      return NextResponse.json(
        { success: false, message: 'Dirección de destino inválida' },
        { status: 400 }
      )
    }

    // Rate limiting
    const sessionHash = getSessionHash(request)
    const rateLimit = await checkRateLimit(sessionHash)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Límite de uso alcanzado (1000 acciones / 16 días)',
          remaining: 0,
          resetAt: rateLimit.resetAt.toISOString()
        },
        { status: 429 }
      )
    }

    // Get API key from request body, env variable, or header
    const resendApiKey = apiKey || 
                         request.headers.get('x-resend-api-key') ||
                         process.env.RESEND_API_KEY

    if (!resendApiKey) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Se requiere una API key de Resend. Configúrala en Ajustes o proporciona una API key.',
          needsApiKey: true
        },
        { status: 401 }
      )
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey)

    // Determine sender
    const senderEmail = fromEmail || 'onboarding@resend.dev'
    const senderName = fromName || 'AgentMail'
    const fromField = fromName ? `${fromName} <${senderEmail}>` : senderEmail

    // Validate that onboarding@resend.dev can only be used with test emails
    if (senderEmail === 'onboarding@resend.dev' && !resendApiKey.startsWith('re_test')) {
      // Allow it - Resend allows sending from onboarding@resend.dev with any API key
    }

    // Send email
    const { data, error } = await resend.emails.send({
      from: fromField,
      to: [to],
      subject,
      html,
      ...(replyTo && { replyTo }),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: `Error al enviar email: ${error.message}`,
          error: error
        },
        { status: 500 }
      )
    }

    // Log usage
    await logUsage(sessionHash, 'send_email')

    // Calculate new remaining count
    const newRateLimit = await checkRateLimit(sessionHash)

    return NextResponse.json({
      success: true,
      message: 'Email enviado exitosamente',
      emailId: data?.id,
      remaining: newRateLimit.remaining,
    })

  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Error interno: ${error.message || 'Unknown error'}` 
      },
      { status: 500 }
    )
  }
}
