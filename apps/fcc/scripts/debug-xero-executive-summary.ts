import fetch from 'node-fetch'
import * as https from 'https'

const agent = new https.Agent({
  rejectUnauthorized: false
})

const AUTH_COOKIE_ENV = 'FCC_AUTH_COOKIE'
const cookies = process.env[AUTH_COOKIE_ENV]

if (!cookies) {
  throw new Error(
    `Missing authentication cookie. Set ${AUTH_COOKIE_ENV} with a valid central session cookie string (include NextAuth + Xero tokens).`
  )
}

async function debugExecutiveSummary() {
  try {
    console.log('Fetching Xero Executive Summary report to check cash flow data...\n')

    // Call internal API that fetches executive summary
    const url = 'https://localhost:3003/api/v1/xero/executive-summary'

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookies,
      },
      // @ts-ignore
      agent,
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Error:', data)
      return
    }

    console.log('Executive Summary Response:\n')
    console.log(JSON.stringify(data, null, 2))

    // Look for cash-related fields
    console.log('\n=== SEARCHING FOR CASH-RELATED DATA ===\n')

    const searchTerms = ['cash', 'flow', 'operating', 'investing', 'financing', 'bank']

    function searchObject(obj: any, path: string = ''): void {
      if (!obj || typeof obj !== 'object') return

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key

        // Check if key contains any search terms
        const keyLower = key.toLowerCase()
        if (searchTerms.some(term => keyLower.includes(term))) {
          console.log(`Found "${key}" at ${currentPath}:`, value)
        }

        // Check if value is string and contains search terms
        if (typeof value === 'string') {
          const valueLower = value.toLowerCase()
          if (searchTerms.some(term => valueLower.includes(term))) {
            console.log(`Found value containing cash terms at ${currentPath}:`, value)
          }
        }

        // Recurse into objects and arrays
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              searchObject(item, `${currentPath}[${index}]`)
            })
          } else {
            searchObject(value, currentPath)
          }
        }
      }
    }

    searchObject(data)
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

// Run the debug script
debugExecutiveSummary()
