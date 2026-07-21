import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getGlobalStats } from '@/lib/supabase'

export async function GET() {
  try {
    const [localAccounts, localMessages, globalStats] = await Promise.all([
      db.emailAccount.count(),
      db.emailMessage.count(),
      getGlobalStats(),
    ])

    return NextResponse.json({
      success: true,
      stats: {
        localAccounts,
        localMessages,
        globalAccounts: globalStats.totalAccounts,
        globalMessages: globalStats.totalMessages,
      },
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
