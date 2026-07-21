import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logUsage } from '@/lib/supabase'
import crypto from 'crypto'

// AgentMail uses Guerrilla Mail API as primary provider
// API docs: https://guerrillamail.com/GuerrillaMailAPI.html

const GUERRILLA_API = 'https://api.guerrillamail.com/ajax.php'

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

    // Try Guerrilla Mail first
    let address = ''
    let sidToken = ''
    let seq = 0

    try {
      const gmRes = await fetch(`${GUERRILLA_API}?f=get_email_address&lang=es`, {
        signal: AbortSignal.timeout(15000),
      })
      
      if (gmRes.ok) {
        const gmData = await gmRes.json()
        address = gmData.email_addr || ''
        sidToken = gmData.sid_token || ''
        seq = gmData.seq || 0
      }
    } catch (gmErr: any) {
      console.error('Guerrilla Mail error:', gmErr.message)
    }

    // Fallback: try mail.tm
    if (!address) {
      try {
        const domainsRes = await fetch('https://api.mail.tm/domains', {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        })
        
        if (domainsRes.ok) {
          const domainsData = await domainsRes.json()
          const domains = Array.isArray(domainsData) ? domainsData : (domainsData['hydra:member'] || [])
          
          if (domains.length > 0) {
            const domain = domains[0].domain
            const username = 'agent' + Math.random().toString(36).substring(2, 8)
            address = `${username}@${domain}`
            const password = Math.random().toString(36).substring(2, 14) + 'A1!'
            
            const createRes = await fetch('https://api.mail.tm/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ address, password }),
              signal: AbortSignal.timeout(10000),
            })
            
            if (createRes.ok) {
              const account = await createRes.json()
              
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
                provider: 'mailtm',
                account: {
                  id: account.id,
                  address,
                  password,
                  token,
                  expiresAt,
                  remaining: rateCheck.remaining - 1,
                },
              })
            }
          }
        }
      } catch (tmErr: any) {
        console.error('Mail.tm error:', tmErr.message)
      }
    }

    if (!address) {
      return NextResponse.json(
        { error: 'All providers failed', message: 'No se pudo crear la cuenta de email temporal. Todos los proveedores fallaron. Inténtalo de nuevo en unos minutos.' },
        { status: 503 }
      )
    }

    await logUsage(sessionHash, 'generate_email')

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 60) // Guerrilla Mail lasts ~1 hour

    return NextResponse.json({
      success: true,
      provider: 'guerrillamail',
      account: {
        id: sidToken,
        address,
        sidToken,
        seq,
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
