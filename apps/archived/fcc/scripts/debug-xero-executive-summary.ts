import fetch from 'node-fetch';
import * as https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false
});

// Session cookies from your environment
const cookies = [
  'next-auth=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..GOPudA32apQ4_9Wy.IWS7cUFGc3JOH027cSdfe2in05XEn7HlbKPkNajUXZzMGO9Eq6f1B4yAmeN9CWtQJ1kQLFtarD-pNP5vR0ZBoWTUUG1KAaitTjhnvndD1UAn2-jXfgEIdq_N1efIEVOWmzKPsnkfos4emhC5jP2sKipUXotTApZkNvVpcEVoxR65tfoa4WId5tr35A-U2Oy-HNEyh7UdeAiJFEl0okQu-Y8vSYkZ9_ic15n4LCSjP420PV1WGI9MESu5FBuUdvIGHHl9TAVfK1fMDCW8z_LGkU_3wf3iAGapgRC5bhuiSGhHkbT7M1kBrbtl12LUk7va7wT2zCWdDsHEaoVX-mqlJ_TqCbD5vtU4psnkOcFzxG9vkV7w-D-Y4coVupfMuwQs1_wjww72.kfVbKrULtlADr-nTMOa0yA',
  'user_session=%7B%22user%22%3A%7B%22id%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22name%22%3A%22Jarrar%20Amjad%22%7D%2C%22userId%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22tenantId%22%3A%22ca9f2956-55ce-47de-8e9f-b1f74c26098f%22%2C%22tenantName%22%3A%22TRADEMAN%20ENTERPRISE%20LTD%22%7D',
  'xero_token=%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTEzODIzNTAsImV4cCI6MTc1MTM4NDE1MCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTM4MjM0NiwieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6IjA1OTViNTRjZTkxMDRjY2I4ZDM1YWJkMzA1MmEwNGY3Iiwic2lkIjoiMDU5NWI1NGNlOTEwNGNjYjhkMzVhYmQzMDUyYTA0ZjciLCJqdGkiOiI5MkUyODE1Rjk5RjhBMEMxMUM3OEJCQ0I3OEQxRkNFNyIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiMDdmYzUwMzYtYjE1YS00ZWJlLWEwNTUtYWI3N2IxNTIwMTg2Iiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJsZWdhY3kiXX0.DMo8thBEYlst0fH6KuWEq2k20nWPG_vLC7oMX73bPGYCpKESOp-w0ONJ1typdoUQE1B2nWbrE7hceUm51x_91s9AQBfngvOqIQowNrl8SrTElM_VPh7rl08wYY9U1ujXUS6a6mWFfTLQutu6FhaWoGjl3NgFXkufXoNkOLdRht9Wb_payHUhjGNeMAlD7MygBmgk6rXT6yPWPxN9H0dlBu29Cx5uk1L11yrJv0XAK7Xg-r3KI17JRwnDqKlicmYFAOl3i4ghzo-YW1hl33kPCAvT3PMelA-ihVAfZUz65ObOp-ZgCGl4mWKLQSQsIO418pw8SI-yEBVkiS3SFy-VIA%22%2C%22refresh_token%22%3A%220o8CRJICj9M-yx-5wgE51H20pf4vCT4MTluMte_wIZ8%22%2C%22expires_at%22%3A1751384150%2C%22expires_in%22%3A1799%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'
].join('; ');

async function debugExecutiveSummary() {
  try {
    console.log('Fetching Xero Executive Summary report to check cash flow data...\n');
    
    // Call internal API that fetches executive summary
    const url = 'https://localhost:3003/api/v1/xero/executive-summary';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookies
      },
      // @ts-ignore
      agent
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error:', data);
      return;
    }
    
    console.log('Executive Summary Response:\n');
    console.log(JSON.stringify(data, null, 2));
    
    // Look for cash-related fields
    console.log('\n=== SEARCHING FOR CASH-RELATED DATA ===\n');
    
    const searchTerms = ['cash', 'flow', 'operating', 'investing', 'financing', 'bank'];
    
    function searchObject(obj: any, path: string = ''): void {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if key contains any search terms
        const keyLower = key.toLowerCase();
        if (searchTerms.some(term => keyLower.includes(term))) {
          console.log(`Found "${key}" at ${currentPath}:`, value);
        }
        
        // Check if value is string and contains search terms
        if (typeof value === 'string') {
          const valueLower = value.toLowerCase();
          if (searchTerms.some(term => valueLower.includes(term))) {
            console.log(`Found value containing cash terms at ${currentPath}:`, value);
          }
        }
        
        // Recurse into objects and arrays
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              searchObject(item, `${currentPath}[${index}]`);
            });
          } else {
            searchObject(value, currentPath);
          }
        }
      }
    }
    
    searchObject(data);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the debug script
debugExecutiveSummary();