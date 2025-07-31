import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  activeUsers: number
  success: boolean
  error?: string
}

// In-memory cache
let cachedUsers: { value: number; timestamp: number } | null = null
const CACHE_DURATION = 60 * 1000 // 1 minute

/**
 * API endpoint to get active user count from PostHog
 * This keeps the PostHog API key secure on the server side
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      activeUsers: 0,
      success: false,
      error: 'Method not allowed',
    })
  }

  try {
    const now = Date.now()

    // Serve from cache if not expired
    if (cachedUsers && now - cachedUsers.timestamp < CACHE_DURATION) {
      return res.status(200).json({
        activeUsers: cachedUsers.value,
        success: true,
      })
    }

    // Fetch fresh data
    const activeUsers = await fetchActiveUsersFromPostHog()

    if (activeUsers !== null) {
      cachedUsers = {
        value: activeUsers,
        timestamp: now,
      }

      return res.status(200).json({
        activeUsers,
        success: true,
      })
    }

    throw new Error('Failed to retrieve active users')
  } catch (error) {
    console.error('Error in active-users API:', error)
    return res.status(500).json({
      activeUsers: 0,
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Fetch active users from PostHog Insights API (server-side only)
 */
async function fetchActiveUsersFromPostHog(): Promise<number | null> {
  const posthogUrl = process.env.POSTHOG_URL || 'https://us.posthog.com'
  const projectId = process.env.POSTHOG_PROJECT_ID
  const personalApiKey = process.env.POSTHOG_API_KEY

  const url = `${posthogUrl}/api/projects/${projectId}/query/`

  const now = new Date()
  const twentyFourHoursAgo = new Date(
    now.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${personalApiKey}`,
      },
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query: `
            SELECT count(DISTINCT person_id) as recent_users
            FROM events
            WHERE event = '$pageview'
              AND timestamp > toDateTime('${twentyFourHoursAgo}')
          `,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText)
    }

    const data = await response.json()
    return data.results[0][0]
  } catch (error) {
    console.error('Error fetching recent users:', error)
    return null
  }
}
