'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mail, Send, Shield, Zap, Globe, Scale, AlertTriangle,
  Settings, Check, Loader2, KeyRound, FileText, Clock,
  UserX, Sparkles, Eye, EyeOff, Copy
} from 'lucide-react'

interface SendResult {
  success: boolean
  message: string
  emailId?: string
  remaining?: number
  needsApiKey?: boolean
}

export default function Home() {
  // Form state
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  
  // UI state
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [remaining, setRemaining] = useState<number>(1000)
  const [showRules, setShowRules] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('compose')

  // Load saved API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('resend_api_key')
    if (savedKey) setApiKey(savedKey)
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/email/usage')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setRemaining(data.remaining)
      }
    } catch {}
  }

  const saveApiKey = () => {
    localStorage.setItem('resend_api_key', apiKey)
    setShowSettings(false)
  }

  const sendEmail = async () => {
    if (!to || !subject || !htmlContent) {
      setResult({ success: false, message: 'Completá los campos obligatorios: Para, Asunto y Mensaje' })
      return
    }

    setSending(true)
    setResult(null)

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          html: htmlContent,
          fromName: fromName || undefined,
          fromEmail: fromEmail || undefined,
          replyTo: replyTo || undefined,
          apiKey: apiKey || undefined,
        }),
      })

      const data = await res.json()
      setResult(data)

      if (data.success) {
        if (data.remaining !== undefined) setRemaining(data.remaining)
        // Don't clear form on success so user can re-send
      }
    } catch {
      setResult({ success: false, message: 'Error de conexión al enviar el email' })
    } finally {
      setSending(false)
    }
  }

  const insertTemplate = (template: string) => {
    switch (template) {
      case 'interview':
        setSubject('Invitación a Entrevista - Google Meet')
        setFromName('KDSotware - Recursos Humanos')
        setHtmlContent(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
  <div style="background: linear-gradient(135deg, #1e3a5f, #2d5a8e); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">KDSotware</h1>
    <p style="color: #94a3b8; margin: 4px 0 0;">Departamento de Recursos Humanos</p>
  </div>
  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #334155;">Estimado/a candidato/a,</p>
    <p style="font-size: 16px; color: #334155;">Nos complace informarle que ha sido seleccionado/a para la siguiente etapa del proceso de selección en <strong>KDSotware</strong>.</p>
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1e40af;">Reunión por Google Meet</p>
      <p style="margin: 0; color: #334155;">Para unirte a la reunión, hacé clic en este vínculo:</p>
      <a href="https://meet.google.com/bqu-rsee-edn" style="display: inline-block; margin: 12px 0; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Unirse a Google Meet</a>
      <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">O abrí Meet y escribí este código: <strong style="color: #1e40af;">bqu-rsee-edn</strong></p>
    </div>
    <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Si tenés alguna consulta, no dudes en responder este correo.</p>
    <p style="font-size: 16px; color: #334155;">Saludos cordiales,</p>
    <p style="font-size: 16px; color: #334155; margin-bottom: 4px;"><strong>Departamento de Recursos Humanos</strong></p>
    <p style="color: #3b82f6; font-weight: 600;">KDSotware</p>
  </div>
  <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
    <p>Este correo fue enviado a través de AgentMail - Envío de Email para Agentes</p>
  </div>
</div>`)
        break
      case 'notification':
        setSubject('Notificación Importante')
        setFromName('AgentMail')
        setHtmlContent(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f1f5f9; padding: 20px; border-radius: 12px;">
    <h2 style="color: #1e293b; margin-top: 0;">Notificación</h2>
    <p style="color: #475569; font-size: 16px;">Escribí tu mensaje aquí...</p>
    <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="color: #64748b; font-size: 14px; margin: 0;">Contenido del mensaje</p>
    </div>
  </div>
</div>`)
        break
      case 'plain':
        setSubject('')
        setFromName('')
        setHtmlContent(`<p>Escribí tu mensaje aquí...</p>`)
        break
    }
  }

  const usagePercentage = ((1000 - remaining) / 1000) * 100

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Send className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AgentMail</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Envío de Email para Agentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              <Zap className="w-3 h-3" />
              {remaining}/1000
            </Badge>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setShowSettings(true)}>
              <Settings className="w-3.5 h-3.5" />
              Ajustes
            </Button>
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
                    <p className="text-muted-foreground">AgentMail es un servicio de envío de email diseñado para que los agentes puedan enviar comunicaciones legítimas. Queda <strong>estrictamente prohibido</strong> usar este servicio para spam, fraude, phishing, suplantación de identidad, o cualquier actividad ilegal.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" />2. Límite de Uso</h3>
                    <p className="text-muted-foreground">El servicio está limitado a <strong>1000 envíos cada 16 días</strong> por sesión. Esto incluye cada email enviado a través de la plataforma. Este límite existe para garantizar la disponibilidad y prevenir abuso.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><UserX className="w-4 h-4 text-purple-500" />3. Responsabilidad del Remitente</h3>
                    <p className="text-muted-foreground">El usuario es <strong>responsable total</strong> del contenido de los emails enviados. AgentMail actúa únicamente como herramienta de envío y no se hace responsable del contenido de los mensajes transmitidos.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />4. Actividades Prohibidas</h3>
                    <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Enviar spam o correo no solicitado masivo</li>
                      <li>Phishing o suplantación de identidad</li>
                      <li>Distribuir malware o contenido malicioso</li>
                      <li>Evadir los límites de uso mediante múltiples sesiones</li>
                      <li>Usar el servicio para fines ilegales</li>
                      <li>Enviar contenido que viole derechos de terceros</li>
                    </ul>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-teal-500" />5. Proveedor de Email</h3>
                    <p className="text-muted-foreground">AgentMail utiliza <strong>Resend</strong> como proveedor de envío. Necesitás una API key de Resend para enviar emails. Resend ofrece un plan gratuito de 100 emails/día y 3,000 emails/mes. El dominio de envío por defecto es <code className="bg-muted px-1 rounded">onboarding@resend.dev</code> para pruebas.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-500" />6. Jurisdicción</h3>
                    <p className="text-muted-foreground">Este servicio opera en la nube (Vercel + Supabase) y está diseñado para agentes de todo el mundo. El uso del servicio desde jurisdicciones donde esté prohibido es responsabilidad exclusiva del usuario.</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground text-center">
                      AgentMail v2.0 — Servicio de envío de email para agentes del mundo<br/>
                      Proveedor: Resend | Infraestructura: Vercel + Supabase<br/>
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
        {/* API Key Warning */}
        {!apiKey && (
          <Card className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4 flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Se requiere API Key de Resend para enviar emails</p>
                <p className="text-xs text-muted-foreground mt-1">Obtené una gratis en <a href="https://resend.com/signup" target="_blank" rel="noopener" className="text-primary underline">resend.com</a> y configurala en Ajustes.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="gap-1">
                <Settings className="w-3.5 h-3.5" />
                Configurar
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="compose" className="gap-1">
              <Send className="w-3.5 h-3.5" />
              Componer
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Plantillas
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1" onClick={() => setShowPreview(true)}>
              <Eye className="w-3.5 h-3.5" />
              Vista Previa
            </TabsTrigger>
          </TabsList>

          {/* COMPOSE TAB */}
          <TabsContent value="compose" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Nuevo Email
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* To */}
                <div className="space-y-1.5">
                  <Label htmlFor="to" className="text-sm font-medium">
                    Para * <span className="text-muted-foreground font-normal">(email del destinatario)</span>
                  </Label>
                  <Input
                    id="to"
                    type="email"
                    placeholder="destinatario@ejemplo.com"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="font-mono"
                  />
                </div>

                {/* From & Reply-To */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fromName" className="text-sm font-medium">
                      Nombre del Remitente
                    </Label>
                    <Input
                      id="fromName"
                      placeholder="Ej: KDSotware - RRHH"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fromEmail" className="text-sm font-medium">
                      Email del Remitente
                    </Label>
                    <Input
                      id="fromEmail"
                      type="email"
                      placeholder="onboarding@resend.dev"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Dejá vacío para usar onboarding@resend.dev</p>
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-sm font-medium">Asunto *</Label>
                  <Input
                    id="subject"
                    placeholder="Asunto del email"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* HTML Content */}
                <div className="space-y-1.5">
                  <Label htmlFor="htmlContent" className="text-sm font-medium">Mensaje (HTML) *</Label>
                  <Textarea
                    id="htmlContent"
                    placeholder="<p>Escribí tu mensaje aquí...</p>"
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    className="font-mono min-h-[200px] text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Podés usar HTML para dar formato al mensaje</p>
                </div>

                {/* Reply To */}
                <div className="space-y-1.5">
                  <Label htmlFor="replyTo" className="text-sm font-medium">
                    Responder a <span className="text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="replyTo"
                    type="email"
                    placeholder="reply-to@ejemplo.com"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    className="font-mono"
                  />
                </div>

                {/* Send Button */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    size="lg"
                    className="gap-2 px-8"
                    onClick={sendEmail}
                    disabled={sending || remaining <= 0}
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {sending ? 'Enviando...' : 'Enviar Email'}
                  </Button>
                  <Button variant="outline" size="lg" className="gap-2" onClick={() => setShowPreview(true)}>
                    <Eye className="w-4 h-4" />
                    Vista Previa
                  </Button>
                </div>

                {/* Result */}
                {result && (
                  <Card className={`mt-4 ${result.success ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' : 'border-red-500/50 bg-red-50 dark:bg-red-950/20'}`}>
                    <CardContent className="pt-4 flex items-start gap-3">
                      {result.success ? (
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {result.success ? 'Email enviado exitosamente!' : 'Error al enviar'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{result.message}</p>
                        {result.emailId && (
                          <p className="text-xs text-muted-foreground mt-1">ID: {result.emailId}</p>
                        )}
                        {result.needsApiKey && (
                          <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => setShowSettings(true)}>
                            <KeyRound className="w-3.5 h-3.5" />
                            Configurar API Key
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Plantillas Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => { insertTemplate('interview'); setActiveTab('compose') }}
                  className="text-left p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-3">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="font-medium text-sm">Invitación a Entrevista</p>
                  <p className="text-xs text-muted-foreground mt-1">Email profesional con link de Google Meet</p>
                </button>

                <button
                  onClick={() => { insertTemplate('notification'); setActiveTab('compose') }}
                  className="text-left p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-3">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="font-medium text-sm">Notificación</p>
                  <p className="text-xs text-muted-foreground mt-1">Notificación simple con formato limpio</p>
                </button>

                <button
                  onClick={() => { insertTemplate('plain'); setActiveTab('compose') }}
                  className="text-left p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-3">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="font-medium text-sm">Mensaje Simple</p>
                  <p className="text-xs text-muted-foreground mt-1">Email en blanco para mensaje personalizado</p>
                </button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PREVIEW TAB */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Vista Previa del Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                {htmlContent ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline">De: {fromName || 'AgentMail'} &lt;{fromEmail || 'onboarding@resend.dev'}&gt;</Badge>
                      <Badge variant="outline">Para: {to || '(sin destinatario)'}</Badge>
                      <Badge variant="outline">Asunto: {subject || '(sin asunto)'}</Badge>
                    </div>
                    <Separator />
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground border-b">
                        Vista previa del contenido HTML
                      </div>
                      <div 
                        className="p-4 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Componé un email para ver la vista previa</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Usage Card */}
        <Card className="mt-6 border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Cuota de envío</span>
              <span className="text-sm text-muted-foreground">{remaining} / 1000 envíos restantes</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">Se reinicia cada 16 días</p>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">¿Cómo funciona?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { step: 'Configurá', desc: 'Agregá tu API key de Resend', icon: <Settings className="w-5 h-5" /> },
                { step: 'Componé', desc: 'Escribí el email con formato', icon: <Mail className="w-5 h-5" /> },
                { step: 'Previsualizá', desc: 'Revisá antes de enviar', icon: <Eye className="w-5 h-5" /> },
                { step: 'Enviá', desc: 'El email llega al destino', icon: <Send className="w-5 h-5" /> },
              ].map((item, i) => (
                <div key={i} className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                    {item.icon}
                  </div>
                  <p className="text-sm font-medium">{item.step}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <Shield className="w-8 h-8 text-green-500 mb-2" />
              <CardTitle className="text-base">Envío Seguro</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Emails enviados a través de Resend, con infraestructura de nivel empresarial. Rate limiting para prevenir abuso.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Zap className="w-8 h-8 text-amber-500 mb-2" />
              <CardTitle className="text-base">Instantáneo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Componé y enviá emails en segundos. Plantillas incluidas para los casos de uso más comunes de los agentes.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Globe className="w-8 h-8 text-cyan-500 mb-2" />
              <CardTitle className="text-base">100% Nube</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Desplegado en Vercel + Supabase + Resend. Sin VPS, sin servidores. Disponible desde cualquier lugar del mundo.</p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración
            </DialogTitle>
            <DialogDescription>Configurá tu API key de Resend para enviar emails</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-sm font-medium">Resend API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="re_xxxxxxxxxxxxx"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Obtené tu API key gratuita en{' '}
                <a href="https://resend.com/signup" target="_blank" rel="noopener" className="text-primary underline">
                  resend.com/signup
                </a>
              </p>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <p className="text-xs font-medium">Plan Gratuito de Resend:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• 100 emails/día</li>
                <li>• 3,000 emails/mes</li>
                <li>• Envío desde onboarding@resend.dev</li>
                <li>• Sin tarjeta de crédito</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveApiKey} className="flex-1 gap-1">
                <Check className="w-4 h-4" />
                Guardar
              </Button>
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="border-t bg-background/80 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            AgentMail v2.0 — Envío de email para agentes del mundo | Proveedor: Resend | Infra: Vercel + Supabase | Límite: 1000 envíos / 16 días
          </p>
        </div>
      </footer>
    </div>
  )
}
