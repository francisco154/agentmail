'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Mail, Copy, RefreshCw, Trash2, Shield, Clock, Zap, Globe,
  Eye, AlertTriangle, Check, Scale, KeyRound, Timer, UserX,
  FileText, Loader2
} from 'lucide-react'

interface EmailAccount {
  id: string
  address: string
  password?: string
  token?: string | null
  sidToken?: string
  seq?: number
  expiresAt: string
  remaining: number
}

interface EmailMessage {
  id: string
  fromAddress: string
  fromName: string | null
  subject: string
  intro: string
  isRead: boolean
  receivedAt: string
  provider?: string
}

interface FullMessage {
  id: string
  fromAddress: string
  fromName: string | null
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  isRead: boolean
  receivedAt: string
}

export default function Home() {
  const [account, setAccount] = useState<EmailAccount | null>(null)
  const [provider, setProvider] = useState<string>('guerrillamail')
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [selectedMessage, setSelectedMessage] = useState<FullMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingInbox, setLoadingInbox] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(false)
  const [copied, setCopied] = useState(false)
  const [remaining, setRemaining] = useState<number>(1000)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [showRules, setShowRules] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [expiryTimer, setExpiryTimer] = useState('')
  const refreshInterval = useRef<NodeJS.Timeout | null>(null)
  const countdownInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { fetchUsage() }, [])

  useEffect(() => {
    if (autoRefresh && account) {
      refreshInterval.current = setInterval(() => { fetchInbox() }, 10000)
      setCountdown(10)
      countdownInterval.current = setInterval(() => {
        setCountdown(prev => prev <= 0 ? 10 : prev - 1)
      }, 1000)
    }
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current)
      if (countdownInterval.current) clearInterval(countdownInterval.current)
    }
  }, [autoRefresh, account])

  useEffect(() => {
    if (!account) return
    const interval = setInterval(() => {
      const expires = new Date(account.expiresAt)
      const now = new Date()
      const diff = expires.getTime() - now.getTime()
      if (diff <= 0) {
        setExpiryTimer('Expirado')
        clearInterval(interval)
      } else {
        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setExpiryTimer(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [account])

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/email/usage')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setRemaining(data.remaining)
      }
    } catch {}
  }

  const generateEmail = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email/generate', { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.success) {
        setAccount(data.account)
        setProvider(data.provider || 'guerrillamail')
        setMessages([])
        setSelectedMessage(null)
        setRemaining(data.account.remaining)
      } else {
        alert(data.message || 'Error al crear el email temporal')
      }
    } catch {
      alert('Error de conexión al crear el email temporal')
    } finally {
      setLoading(false)
    }
  }

  const fetchInbox = useCallback(async () => {
    if (!account) return
    setLoadingInbox(true)
    try {
      const params = new URLSearchParams({
        provider,
        address: account.address,
        ...(provider === 'guerrillamail' 
          ? { sidToken: account.sidToken || account.id, seq: String(account.seq || 0) }
          : { password: account.password || '' }
        ),
      })
      const res = await fetch(`/api/email/inbox?${params}`)
      const data = await res.json()

      if (data.success) {
        setMessages(data.messages)
        if (data.remaining !== undefined) setRemaining(data.remaining)
        // Update seq for guerrillamail
        if (provider === 'guerrillamail' && data.messages.length > 0) {
          // Keep seq updated for next check
        }
      }
    } catch {} finally {
      setLoadingInbox(false)
    }
  }, [account, provider])

  const openMessage = async (messageId: string) => {
    if (!account) return
    setLoadingMessage(true)
    try {
      const params = new URLSearchParams({
        messageId,
        provider,
        address: account.address,
        ...(provider === 'guerrillamail'
          ? { sidToken: account.sidToken || account.id }
          : { password: account.password || '' }
        ),
      })
      const res = await fetch(`/api/email/message?${params}`)
      const data = await res.json()

      if (data.success) {
        setSelectedMessage(data.message)
        setShowMessage(true)
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead: true } : m))
      }
    } catch {} finally {
      setLoadingMessage(false)
    }
  }

  const deleteMessage = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!account) return
    try {
      const params = new URLSearchParams({
        messageId,
        provider,
        ...(provider === 'guerrillamail'
          ? { sidToken: account.sidToken || account.id }
          : {}
        ),
      })
      const res = await fetch(`/api/email/message?${params}`, { method: 'DELETE' })
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId))
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null)
          setShowMessage(false)
        }
      }
    } catch {}
  }

  const copyAddress = async () => {
    if (!account) return
    try {
      await navigator.clipboard.writeText(account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const usagePercentage = ((1000 - remaining) / 1000) * 100

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AgentMail</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Email Temporal para Agentes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs gap-1">
              <Zap className="w-3 h-3" />
              {remaining}/1000
            </Badge>
            <Dialog open={showRules} onOpenChange={setShowRules}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  <Scale className="w-3.5 h-3.5" />
                  Reglas
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Scale className="w-5 h-5" />
                    Reglas y Condiciones de Uso
                  </DialogTitle>
                  <DialogDescription>Al usar AgentMail, aceptás estas condiciones</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-green-500" />1. Uso Autorizado</h3>
                    <p className="text-muted-foreground">AgentMail es un servicio de email temporal diseñado para proteger tu privacidad. Solo debe usarse para recibir comunicaciones legítimas y verificar identidades en línea. Queda <strong>estrictamente prohibido</strong> usar este servicio para actividades ilegales, fraude, phishing, suplantación de identidad, o cualquier acción que viole la ley.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Timer className="w-4 h-4 text-amber-500" />2. Límite de Uso</h3>
                    <p className="text-muted-foreground">El servicio está limitado a <strong>1000 acciones cada 16 días</strong> por sesión. Esto incluye generar emails, revisar bandejas, leer mensajes y eliminar correos. Este límite existe para garantizar la disponibilidad del servicio para todos los agentes y prevenir abuso.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" />3. Naturaleza Temporal</h3>
                    <p className="text-muted-foreground">Las cuentas de email generadas son <strong>temporales y se eliminan automáticamente</strong>. Los mensajes recibidos no se almacenan permanentemente. Una vez que la cuenta expira, toda la información asociada se pierde y no puede ser recuperada.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><UserX className="w-4 h-4 text-purple-500" />4. Privacidad y Anonimato</h3>
                    <p className="text-muted-foreground">No recopilamos información personal identificable. El seguimiento de uso se basa en hashes anónimos de sesión. No compartimos datos con terceros bajo ninguna circunstancia.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />5. Actividades Prohibidas</h3>
                    <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Enviar spam o correo no solicitado</li>
                      <li>Crear cuentas en plataformas con intención de fraude</li>
                      <li>Suplantar identidades de terceros</li>
                      <li>Distribuir malware o contenido malicioso</li>
                      <li>Evadir los límites de uso mediante múltiples sesiones</li>
                      <li>Usar bots o scripts automatizados sin autorización</li>
                    </ul>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-teal-500" />6. Disponibilidad</h3>
                    <p className="text-muted-foreground">AgentMail se proporciona &quot;tal cual&quot; sin garantías de disponibilidad continua. Usamos múltiples proveedores (Guerrilla Mail + mail.tm) para maximizar la disponibilidad.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-500" />7. Jurisdicción</h3>
                    <p className="text-muted-foreground">Este servicio opera en la nube (Vercel + Supabase) y está diseñado para agentes de todo el mundo. El uso del servicio desde jurisdicciones donde los emails temporales estén prohibidos es responsabilidad exclusiva del usuario.</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground text-center">
                      AgentMail v1.0 — Servicio de email temporal para agentes del mundo<br/>
                      Multi-provider (Guerrilla Mail + mail.tm) | Vercel + Supabase<br/>
                      Sin dependencia de VPS — 100% en la nube
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">
        {!account ? (
          <div className="space-y-8">
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Email Temporal para Agentes</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Generá una dirección de email temporal al instante. Recibí correos sin exponer tu identidad. 
                Sin registro, sin VPS, 100% en la nube.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <Shield className="w-8 h-8 text-green-500 mb-2" />
                  <CardTitle className="text-base">Privacidad Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Sin registro, sin datos personales. Tu identidad permanece completamente anónima mientras recibís correos de forma segura.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <Zap className="w-8 h-8 text-amber-500 mb-2" />
                  <CardTitle className="text-base">Instantáneo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Generá tu email temporal en segundos. Sin esperas, sin verificación, sin contraseñas. Hacé clic y listo.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <Globe className="w-8 h-8 text-cyan-500 mb-2" />
                  <CardTitle className="text-base">100% Nube</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Desplegado en Vercel + Supabase. Sin VPS, sin servidores. Multi-provider para máxima disponibilidad.</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Cuota de uso</span>
                  <span className="text-sm text-muted-foreground">{remaining} / 1000 acciones restantes</span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Se reinicia cada 16 días</p>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button size="lg" className="gap-2 px-8 text-base" onClick={generateEmail} disabled={loading || remaining <= 0}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {loading ? 'Generando...' : 'Generar Email Temporal'}
              </Button>
            </div>

            {remaining <= 0 && (
              <div className="text-center">
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Límite de uso alcanzado.
                </Badge>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Cómo funciona?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['Generá', 'Copiá', 'Recibí', 'Leé'].map((step, i) => (
                    <div key={i} className="text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <span className="text-sm font-bold text-primary">{i + 1}</span>
                      </div>
                      <p className="text-sm font-medium">{step}</p>
                      <p className="text-xs text-muted-foreground">
                        {['Hacé clic para crear tu email', 'Copiá la dirección', 'Los correos llegan a tu bandeja', 'Leé el contenido y expira'][i]}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Tu email temporal</p>
                    <div className="flex items-center gap-2">
                      <code className="text-lg font-mono font-semibold break-all">{account.address}</code>
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={copyAddress}>
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Clock className="w-3 h-3" />
                      {expiryTimer}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Zap className="w-3 h-3" />
                      {remaining}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {provider === 'guerrillamail' ? 'Guerrilla' : 'mail.tm'}
                    </Badge>
                  </div>
                </div>
                {copied && <p className="text-xs text-green-500 mt-1">Dirección copiada al portapapeles!</p>}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchInbox} disabled={loadingInbox} size="sm" className="gap-1">
                {loadingInbox ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loadingInbox ? 'Cargando...' : 'Refrescar Bandeja'}
              </Button>
              <Button variant={autoRefresh ? 'default' : 'outline'} size="sm" className="gap-1" onClick={() => setAutoRefresh(!autoRefresh)}>
                <Timer className="w-4 h-4" />
                {autoRefresh ? `Auto (${countdown}s)` : 'Auto-Refresh'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={generateEmail} disabled={loading}>
                <KeyRound className="w-4 h-4" />
                Nuevo Email
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Bandeja de Entrada
                  {messages.length > 0 && <Badge variant="secondary" className="ml-auto">{messages.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Mail className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No hay mensajes todavía</p>
                    <p className="text-xs text-muted-foreground">
                      Usá esta dirección para recibir correos. Los mensajes aparecerán aquí.
                    </p>
                    {autoRefresh && <p className="text-xs text-primary">Auto-refresh activado — cada 10s</p>}
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <div className="space-y-1">
                      {messages.map((msg) => (
                        <div key={msg.id} onClick={() => openMessage(msg.id)}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group ${!msg.isRead ? 'bg-primary/5 border-l-2 border-primary' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!msg.isRead ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm truncate ${!msg.isRead ? 'font-semibold' : 'font-medium'}`}>{msg.fromName || msg.fromAddress}</p>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(msg.receivedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={`text-sm truncate ${!msg.isRead ? 'font-medium' : 'text-muted-foreground'}`}>{msg.subject}</p>
                            {msg.intro && <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.intro}</p>}
                          </div>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => deleteMessage(msg.id, e)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Dialog open={showMessage} onOpenChange={setShowMessage}>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="text-base">{selectedMessage?.subject || 'Sin asunto'}</DialogTitle>
                  <DialogDescription>
                    De: {selectedMessage?.fromName || selectedMessage?.fromAddress} — {selectedMessage && new Date(selectedMessage.receivedAt).toLocaleString('es')}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 overflow-y-auto max-h-[50vh]">
                  {loadingMessage ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : selectedMessage?.bodyHtml ? (
                    <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }} />
                  ) : selectedMessage?.bodyText ? (
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg overflow-auto">{selectedMessage.bodyText}</pre>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground"><Eye className="w-8 h-8 mx-auto mb-2" /><p>No se pudo cargar el contenido</p></div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Cuota de uso</span>
                  <span className="text-xs text-muted-foreground">{remaining}/1000 restantes</span>
                </div>
                <Progress value={usagePercentage} className="h-1.5" />
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="border-t bg-background/80 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            AgentMail v1.0 — Email temporal para agentes del mundo | Multi-provider (Guerrilla Mail + mail.tm) | 100% Nube (Vercel) | Límite: 1000 acciones / 16 días
          </p>
        </div>
      </footer>
    </div>
  )
}
