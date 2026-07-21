import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

let supabaseAvailable = false

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test if Supabase table exists
export async function isSupabaseReady(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('agentmail_usage')
      .select('*', { count: 'exact', head: true })
      .limit(1)
    
    if (error) {
      supabaseAvailable = false
      return false
    }
    supabaseAvailable = true
    return true
  } catch {
    supabaseAvailable = false
    return false
  }
}

// Rate limiting constants
const MAX_MESSAGES_PER_PERIOD = 1000
const PERIOD_DAYS = 16

// In-memory rate limit store (fallback when Supabase is unavailable)
const localRateLimitStore = new Map<string, { count: number; periodStart: number }>()

function getLocalRateLimit(sessionHash: string): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = Date.now()
  const periodMs = PERIOD_DAYS * 24 * 60 * 60 * 1000
  
  let entry = localRateLimitStore.get(sessionHash)
  if (!entry || (now - entry.periodStart) > periodMs) {
    entry = { count: 0, periodStart: now }
    localRateLimitStore.set(sessionHash, entry)
  }

  const remaining = Math.max(0, MAX_MESSAGES_PER_PERIOD - entry.count)
  const resetAt = new Date(entry.periodStart + periodMs)
  
  return { allowed: entry.count < MAX_MESSAGES_PER_PERIOD, remaining, resetAt }
}

export async function checkRateLimit(sessionHash: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  // Try Supabase first
  if (supabaseAvailable) {
    try {
      const periodStart = new Date()
      periodStart.setDate(periodStart.getDate() - PERIOD_DAYS)
      
      const { count, error } = await supabase
        .from('agentmail_usage')
        .select('*', { count: 'exact', head: true })
        .eq('session_hash', sessionHash)
        .gte('created_at', periodStart.toISOString())

      if (!error) {
        const used = count || 0
        const remaining = Math.max(0, MAX_MESSAGES_PER_PERIOD - used)
        const resetAt = new Date(periodStart.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000)
        return { allowed: used < MAX_MESSAGES_PER_PERIOD, remaining, resetAt }
      }
    } catch {
      // Fall through to local
    }
  }

  // Fallback to local rate limiting
  return getLocalRateLimit(sessionHash)
}

export async function logUsage(sessionHash: string, action: string): Promise<void> {
  // Increment local counter
  const now = Date.now()
  const periodMs = PERIOD_DAYS * 24 * 60 * 60 * 1000
  let entry = localRateLimitStore.get(sessionHash)
  if (!entry || (now - entry.periodStart) > periodMs) {
    entry = { count: 0, periodStart: now }
    localRateLimitStore.set(sessionHash, entry)
  }
  entry.count++

  // Try Supabase
  if (supabaseAvailable) {
    try {
      await supabase
        .from('agentmail_usage')
        .insert({
          session_hash: sessionHash,
          action,
        })
    } catch {
      // Local counter already incremented, that's fine
    }
  }
}

export async function getGlobalStats(): Promise<{ totalAccounts: number; totalMessages: number }> {
  if (!supabaseAvailable) {
    return { totalAccounts: 0, totalMessages: 0 }
  }

  try {
    const { count: accountCount } = await supabase
      .from('agentmail_usage')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'generate_email')

    const { count: messageCount } = await supabase
      .from('agentmail_usage')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'check_inbox')

    return {
      totalAccounts: accountCount || 0,
      totalMessages: messageCount || 0,
    }
  } catch {
    return { totalAccounts: 0, totalMessages: 0 }
  }
}
