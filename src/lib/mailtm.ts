// Mail.tm API client for temporary email functionality
// API docs: https://api.mail.tm

const MAILTM_BASE = 'https://api.mail.tm'

interface MailTmAccount {
  id: string
  address: string
  password?: string
}

interface MailTmMessage {
  id: string
  from: { address: string; name: string }
  to: { address: string; name: string }[]
  subject: string
  intro: string
  text: string
  html: string[]
  createdAt: string
  seen: boolean
}

interface MailTmDomain {
  id: string
  domain: string
}

let cachedToken: string | null = null
let tokenExpiry = 0

// Get available domains
export async function getAvailableDomains(): Promise<MailTmDomain[]> {
  try {
    const res = await fetch(`${MAILTM_BASE}/domains`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) throw new Error(`Failed to get domains: ${res.status}`)
    const data = await res.json()
    return data['hydra:member'] || data || []
  } catch (error) {
    console.error('Error getting domains:', error)
    // Fallback domains
    return [{ id: '1', domain: 'bugfoo.com' }]
  }
}

// Create a new temporary email account
export async function createTempAccount(): Promise<{ address: string; password: string; id: string } | null> {
  try {
    const domains = await getAvailableDomains()
    if (domains.length === 0) {
      console.error('No domains available')
      return null
    }
    
    const domain = domains[0].domain
    const username = 'agent' + Math.random().toString(36).substring(2, 8)
    const address = `${username}@${domain}`
    const password = Math.random().toString(36).substring(2, 14) + 'A1!'
    
    const res = await fetch(`${MAILTM_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ address, password }),
    })
    
    if (!res.ok) {
      const errText = await res.text()
      console.error('Account creation failed:', res.status, errText)
      return null
    }
    
    const account: MailTmAccount = await res.json()
    return { address, password, id: account.id }
  } catch (error) {
    console.error('Error creating account:', error)
    return null
  }
}

// Authenticate and get token
export async function getToken(address: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${MAILTM_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    })
    
    if (!res.ok) return null
    
    const data = await res.json()
    cachedToken = data.token
    tokenExpiry = Date.now() + 3600 * 1000 // 1 hour
    return data.token
  } catch (error) {
    console.error('Error getting token:', error)
    return null
  }
}

// Get messages from inbox
export async function getMessages(address: string, password: string): Promise<MailTmMessage[]> {
  try {
    const token = await getToken(address, password)
    if (!token) return []
    
    const res = await fetch(`${MAILTM_BASE}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })
    
    if (!res.ok) return []
    
    const data = await res.json()
    return data['hydra:member'] || data || []
  } catch (error) {
    console.error('Error getting messages:', error)
    return []
  }
}

// Get a single message
export async function getMessage(address: string, password: string, messageId: string): Promise<MailTmMessage | null> {
  try {
    const token = await getToken(address, password)
    if (!token) return null
    
    const res = await fetch(`${MAILTM_BASE}/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })
    
    if (!res.ok) return null
    
    return await res.json()
  } catch (error) {
    console.error('Error getting message:', error)
    return null
  }
}

// Delete a message
export async function deleteMessage(address: string, password: string, messageId: string): Promise<boolean> {
  try {
    const token = await getToken(address, password)
    if (!token) return false
    
    const res = await fetch(`${MAILTM_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    
    return res.ok
  } catch (error) {
    console.error('Error deleting message:', error)
    return false
  }
}

// Delete an account
export async function deleteAccount(accountId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${MAILTM_BASE}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    return res.ok
  } catch (error) {
    console.error('Error deleting account:', error)
    return false
  }
}
