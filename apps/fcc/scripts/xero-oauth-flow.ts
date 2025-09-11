#!/usr/bin/env tsx

import { XeroClient } from 'xero-node';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createServer } from 'http';
import open from 'open';

const CLIENT_ID = '781184D1AD314CB6989EB8D2291AB453';
const CLIENT_SECRET = '8aDaYpS8FJgOYJ7_OJ1v1n-MLMq0H9hOgBEU9iG3AMz28zGM';
const REDIRECT_URI = 'http://localhost:5123/callback';
const SCOPES = 'openid profile email accounting.transactions accounting.contacts accounting.settings accounting.reports.read offline_access';

const xero = new XeroClient({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUris: [REDIRECT_URI],
  scopes: SCOPES.split(' ')
});

const tokenSetPath = path.join(process.cwd(), 'xero-tokens.json');

async function startOAuthFlow() {
  console.log('🔐 Starting Xero OAuth flow...\n');
  
  // Build authorization URL
  const authUrl = await xero.buildConsentUrl();
  console.log('📋 Authorization URL:', authUrl);
  
  // Create a simple server to handle the callback
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/callback')) {
      const url = new URL(req.url, `http://localhost:5123`);
      const code = url.searchParams.get('code');
      
      if (code) {
        try {
          console.log('\\n✅ Authorization code received!');
          
          // Exchange code for tokens
          const tokenSet = await xero.apiClient.exchangeCodeForToken(code);
          console.log('🎉 Tokens received successfully!');
          
          // Save tokens
          fs.writeFileSync(tokenSetPath, JSON.stringify(tokenSet, null, 2));
          console.log(`💾 Tokens saved to: ${tokenSetPath}`);
          
          // Set the token on the client
          await xero.setTokenSet(tokenSet);
          
          // Get tenants
          const tenants = await xero.updateTenants();
          console.log('\\n🏢 Available Tenants:');
          tenants.forEach((tenant, index) => {
            console.log(`${index + 1}. ${tenant.tenantName} (${tenant.tenantId})`);
          });
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Success!</h1><p>You can close this window and return to the terminal.</p>');
          
          server.close();
          
          // Test Balance Sheet
          if (tenants.length > 0) {
            await testBalanceSheet(tenants[0].tenantId);
          }
        } catch (error) {
          console.error('❌ Error exchanging code:', error);
          res.writeHead(500);
          res.end('Error exchanging code');
          server.close();
        }
      } else {
        res.writeHead(400);
        res.end('No authorization code received');
        server.close();
      }
    }
  });
  
  server.listen(5123, () => {
    console.log('\\n🌐 Callback server listening on http://localhost:5123');
    console.log('\\n👉 Opening browser to authorize...');
    open(authUrl);
  });
}

async function testBalanceSheet(tenantId: string) {
  try {
    console.log('\\n📊 Testing Balance Sheet API...');
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
    
    const response = await xero.accountingApi.getReportBalanceSheet(
      tenantId,
      undefined, // date - will use today
      3, // periods
      'MONTH' // timeframe
    );
    
    console.log('\\n✅ Balance Sheet received!\\n');
    
    // Extract key information
    const report = response.body.reports?.[0];
    if (report) {
      console.log('📈 BALANCE SHEET SUMMARY');
      console.log('━'.repeat(50));
      console.log(`Report Date: ${report.reportDate}`);
      console.log(`Report Name: ${report.reportName}`);
      console.log(`Report Type: ${report.reportType}`);
      
      // Find key sections
      const sections = report.rows || [];
      
      sections.forEach(section => {
        if (section.rowType === 'Section') {
          console.log(`\\n${section.title || 'Unknown Section'}`);
          
          section.rows?.forEach(row => {
            if (row.cells) {
              const label = row.cells[0]?.value || '';
              const value = row.cells[row.cells.length - 1]?.value || '';
              if (label && value && value !== '') {
                console.log(`  ${label}: ${value}`);
              }
            }
          });
        }
      });
    }
    
    // Save full response
    const outputPath = path.join(process.cwd(), 'balance-sheet-response.json');
    fs.writeFileSync(outputPath, JSON.stringify(response.body, null, 2));
    console.log(`\\n💾 Full response saved to: ${outputPath}`);
    
  } catch (error: any) {
    console.error('\\n❌ Error fetching Balance Sheet:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Check if we have existing tokens
async function loadExistingTokens() {
  if (fs.existsSync(tokenSetPath)) {
    console.log('📂 Found existing tokens, loading...');
    const tokenSet = JSON.parse(fs.readFileSync(tokenSetPath, 'utf-8'));
    
    // Check if expired
    if (tokenSet.expires_at && new Date(tokenSet.expires_at * 1000) < new Date()) {
      console.log('⏰ Tokens expired, refreshing...');
      try {
        const newTokenSet = await xero.refreshToken();
        fs.writeFileSync(tokenSetPath, JSON.stringify(newTokenSet, null, 2));
        await xero.setTokenSet(newTokenSet);
        console.log('✅ Tokens refreshed successfully!');
      } catch (error) {
        console.log('❌ Failed to refresh tokens, need to re-authenticate');
        return false;
      }
    } else {
      await xero.setTokenSet(tokenSet);
      console.log('✅ Tokens loaded successfully!');
    }
    
    // Get tenants
    const tenants = await xero.updateTenants();
    if (tenants.length > 0) {
      await testBalanceSheet(tenants[0].tenantId);
      return true;
    }
  }
  return false;
}

// Main
async function main() {
  console.log('🚀 Xero Balance Sheet Test\\n');
  console.log('Client ID:', CLIENT_ID);
  console.log('Redirect URI:', REDIRECT_URI);
  console.log('');
  
  try {
    // Try to use existing tokens first
    const hasValidTokens = await loadExistingTokens();
    
    if (!hasValidTokens) {
      // Start OAuth flow
      await startOAuthFlow();
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();