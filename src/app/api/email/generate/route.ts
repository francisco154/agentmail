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
    let domainsRes
    try {
      domainsRes = await fetch('https://api.mail.tm/domains', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
    } catch (fetchErr: any) {
      console.error('Domains fetch error:', fetchErr.message)
      return NextResponse.json(
        { error: 'Domains fetch failed', message: `Error al conectar con mail.tm: ${fetchErr.message}` },
        { status: 503 }
      )
    }
    
    if (!domainsRes.ok) {
      const errStatus = domainsRes.status
      const errText = await domainsRes.text().catch(() => 'no body')
      console.error('Domains response error:', errStatus, errText)
      return NextResponse.json(
        { error: 'Failed to get domains', message: `Error ${errStatus} al obtener dominios: ${errText.substring(0, 100)}` },
        { status: 502 }
      )
    }

    let domainsData
    try {
      domainsData = await domainsRes.json()
    } catch (jsonErr: any) {
      console.error('Domains JSON parse error:', jsonErr.message)
      return NextResponse.json(
        { error: 'Parse error', message: 'Error al procesar la respuesta de mail.tm' },
        { status: 502 }
      )
    }

    const domains = Array.isArray(domainsData) ? domainsData : (domainsData['hydra:member'] || [])
    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'No domains', message: 'No hay dominios disponibles para crear emails temporales.' },
        { status: 503 }
      )
    }

    const domain = domains[0].domain
    const username = 'agent' + Math.random().toString(36).substring(2, 8)
    const address = `${username}@${domain}`
    const password = Math.random().toString(36).substring(2, 14) + 'A1!'

    let createRes
    try {
      createRes = await fetch('https://api.mail.tm/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ address, password }),
        signal: AbortSignal.timeout(10000),
      })
    } catch (createErr: any) {
      console.error('Account create fetch error:', createErr.message)
      return NextResponse.json(
        { error: 'Account creation failed', message: `Error al crear cuenta: ${createErr.message}` },
        { status: 503 }
      )
    }

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => 'no body')
      console.error('Account creation failed:', createRes.status, errText)
      return NextResponse.json(
        { error: 'Failed to create email account', message: 'No se pudo crear la cuenta de email temporal. Inténtalo de nuevo.' },
        { status: 500 }
      )
    }

    const account = await createRes.json()

    // Get auth token
    let token = null
    try {
      const tokenRes = await fetch('https://api.mail.tm/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
        signal: AbortSignal.timeout(10000),
      })
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json()
        token = tokenData.token
      }
    } catch {}

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
  } catch (error: any) {
    console.error('Error generating email:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: `Error interno: ${error.message || 'unknown'}` },
      { status: 500 }
    )
  }
}
