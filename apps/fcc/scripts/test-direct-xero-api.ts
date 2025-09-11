#!/usr/bin/env npx tsx
import { XeroClient } from 'xero-node'
import fs from 'fs'

// Parse the Xero token from the cookie value
const cookieTokenValue = '%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTE0NzUwOTgsImV4cCI6MTc1MTQ3Njg5OCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTQ3NTA5NCwieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6ImFhYWFlMDQ1MDNlNTQ0YzI5MTE3NzZlNWFhZGY1YTc1Iiwic2lkIjoiYWFhYWUwNDUwM2U1NDRjMjkxMTc3NmU1YWFkZjVhNzUiLCJqdGkiOiI5NTU5RjZFQjFBOUFDMjgzODI3RkNBRkEwMzE0NEVFOSIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiYmIwM2FlODEtMDgyYS00NmQ4LWExNzUtYjgxYzAwY2RiZTA0Iiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJwd2QiXX0.L12-4A6j4pxQP6c9kL4H78ikJFTb4r2acllG4NKd3YkOxhe3cTJSlDlnUZl2_ONgdPx36un3XZl7XtcPdl4e14tuxlbfqNYsX576PZXGdXqvAbN2IlOeP6Qf2E8_kMpMhu0IPB2-I9YJ66Uu95S43SFLAHyRRcmR0VYC8duU3f9p9yuHwwhAkeoNXRkyBo2asGF9vcqfF0Pk31ZFi2o5kTuX3CjERGiItG8oIe4Gjtw8mQ9DTVrY6NnJceVb7LTkCmA7iS8zLGerOUq7Hq9H33zh5xDbey0EZ4jW2wS3LeDDHpxGA4goT-VQVDQVBgZii82F9NABpC-s2dvHGUqC7Q%22%2C%22refresh_token%22%3A%22815UN9vyiirBvGB4TEGP9Iw-byN0-ty6uimW54uvShs%22%2C%22expires_at%22%3A1751476898%2C%22expires_in%22%3A1799%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'

// Decode the URL-encoded token
const decodedToken = decodeURIComponent(cookieTokenValue)
const tokenData = JSON.parse(decodedToken)

console.log('Token expires at:', new Date(tokenData.expires_at * 1000).toISOString())
console.log('Current time:', new Date().toISOString())

const expired = Date.now() > tokenData.expires_at * 1000
if (expired) {
  console.log('❌ Token has expired!')
  process.exit(1)
}

// Create Xero client
const xeroClient = new XeroClient({
  clientId: '781184D1AD314CB6989EB8D2291AB453',
  clientSecret: process.env.XERO_CLIENT_SECRET || '',
  redirectUris: ['https://localhost:3003/api/auth/callback/xero'],
  scopes: tokenData.scope.split(' ')
})

async function testXeroAPI() {
  // Set the token
  await xeroClient.setTokenSet({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_at,
    token_type: tokenData.token_type,
    scope: tokenData.scope
  })

  // Try to fetch available reports
  try {
  console.log('\nTesting Xero API connectivity...')
  
  // Test 1: Get tenants
  const tenants = await xeroClient.updateTenants()
  console.log('\n✓ Connected to Xero!')
  console.log('Tenants:', tenants.map(t => ({ id: t.tenantId, name: t.tenantName })))
  
  if (tenants.length === 0) {
    console.log('No tenants found!')
    process.exit(1)
  }
  
  const tenantId = tenants[0].tenantId
  console.log(`\nUsing tenant: ${tenants[0].tenantName} (${tenantId})`)
  
  // Test 2: Try to get Bank Summary
  console.log('\nTesting Bank Summary API...')
  try {
    const bankSummary = await xeroClient.accountingApi.getReportBankSummary(
      tenantId,
      new Date('2025-06-01'),
      new Date('2025-06-30')
    )
    
    console.log('✓ Bank Summary API works!')
    console.log('Response structure:', {
      hasBody: !!bankSummary.body,
      hasReports: !!bankSummary.body?.reports,
      reportsLength: bankSummary.body?.reports?.length || 0,
      firstReport: bankSummary.body?.reports?.[0] ? {
        reportName: bankSummary.body.reports[0].reportName,
        reportType: bankSummary.body.reports[0].reportType,
        rowCount: bankSummary.body.reports[0].rows?.length || 0
      } : null
    })
    
    // Save raw response for debugging
    fs.writeFileSync('/tmp/bank-summary-raw.json', JSON.stringify(bankSummary.body, null, 2))
    console.log('\nRaw response saved to /tmp/bank-summary-raw.json')
    
  } catch (error: any) {
    console.log('✗ Bank Summary API failed:', error.message)
    console.log('Error details:', error.response?.body || error)
  }
  
  // Test 3: List available report methods
  console.log('\nChecking available report methods...')
  const reportMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(xeroClient.accountingApi))
    .filter(method => method.startsWith('getReport'))
    .sort()
  
  console.log('Available report methods:')
  reportMethods.forEach(method => console.log(`  - ${method}`))
  
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error('Details:', error.response?.body || error)
  }
}

// Run the test
testXeroAPI().catch(console.error)