import { NextRequest, NextResponse } from 'next/server'
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

    // Create temporary email account via mail.tm API
    const domainsRes = await fetch('https://api.mail.tm/domains', {
      headers: { 'Accept': 'application/json' },
    })
    
    if (!domainsRes.ok) {
      return NextResponse.json(
        { error: 'Failed to get domains', message: 'No se pudieron obtener los dominios disponibles.' },
        { status: 500 }
      )
    }

    const domainsData = await domainsRes.json()
    const domains = Array.isArray(domainsData) ? domainsData : (domainsData['hydra:member'] || [])
    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'No domains', message: 'No hay dominios disponibles para crear emails temporales.' },
        { status: 500 }
      )
    }

    const domain = domains[0].domain
    const username = 'agent' + Math.random().toString(36).substring(2, 8)
    const address = `${username}@${domain}`
    const password = Math.random().toString(36).substring(2, 14) + 'A1!'

    const createRes = await fetch('https://api.mail.tm/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ address, password }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      console.error('Account creation failed:', createRes.status, errText)
      return NextResponse.json(
        { error: 'Failed to create email account', message: 'No se pudo crear la cuenta de email temporal. Inténtalo de nuevo.' },
        { status: 500 }
      )
    }

    const account = await createRes.json()

    // Get auth token
    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    })

    let token = null
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json()
      token = tokenData.token
    }

    await logUsage(sessionHash, 'generate_email')

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        address,
        password,
        token,
        expiresAt,
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
