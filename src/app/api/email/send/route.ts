import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
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
  provider?: 'resend' | 'supabase'
}

function getSessionHash(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const ua = request.headers.get('user-agent') || 'unknown'
  return createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 32)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Fallback: Send email via Supabase Auth (limited but free)
async function sendViaSupabaseAuth(to: string, subject: string, html: string, fromName?: string): Promise<{ success: boolean; message: string }> {
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Use Supabase Auth to send an OTP/magic link email
    // This sends a REAL email through Supabase's Postmark integration
    const { error } = await supabase.auth.signInWithOtp({
      email: to,
      options: {
        data: {
          agentmail_subject: subject,
          agentmail_from: fromName || 'AgentMail',
          agentmail_html: html,
        }
      }
    })

    if (error) {
      // Check for rate limit
      if (error.message.includes('rate limit') || error.code === 'over_email_send_rate_limit') {
        return { success: false, message: 'Rate limit de Supabase Auth alcanzado. Intentá de nuevo más tarde o usá una API key de Resend.' }
      }
      return { success: false, message: `Error de Supabase Auth: ${error.message}` }
    }

    return { success: true, message: 'Email enviado vía Supabase Auth (modo limitado). El destinatario recibirá un email de verificación con tu contenido.' }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json()
    const { to, subject, html, fromName, fromEmail, replyTo, apiKey, provider } = body

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

    // Determine provider
    const useProvider = provider || (resendApiKey ? 'resend' : 'supabase')

    // If explicitly requesting Supabase or no Resend key available
    if (useProvider === 'supabase') {
      const result = await sendViaSupabaseAuth(to, subject, html, fromName)
      
      if (result.success) {
        await logUsage(sessionHash, 'send_email_supabase')
        const newRateLimit = await checkRateLimit(sessionHash)
        return NextResponse.json({
          success: true,
          message: result.message,
          provider: 'supabase',
          remaining: newRateLimit.remaining,
        })
      } else {
        return NextResponse.json({
          success: false,
          message: result.message,
          needsApiKey: result.message.includes('API key'),
        }, { status: 500 })
      }
    }

    // Resend provider
    if (!resendApiKey) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Se requiere una API key de Resend. Configúrala en Ajustes o usá el modo Supabase.',
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
    await logUsage(sessionHash, 'send_email_resend')

    // Calculate new remaining count
    const newRateLimit = await checkRateLimit(sessionHash)

    return NextResponse.json({
      success: true,
      message: 'Email enviado exitosamente via Resend',
      emailId: data?.id,
      provider: 'resend',
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
