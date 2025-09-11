import jwt from 'jsonwebtoken';
import axios from 'axios';
import https from 'https';
import path from 'path';
import fs from 'fs';

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function decodeAndTest() {
  // The JWT token from the browser
  const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NUb2tlbiI6ImV5SmhiR2NpT2lKU1V6STFOaUlzSW10cFpDSTZJakZEUWpjMlJrWTNSREl5TlRaRFFqQTVRemhDT1VFM1JEYzJOelkxTnpnME16QTBPRU0xT1RRaUxDSjBlWEFpT2lKS1YxUWlMQ0o0TlhRaU9pSlNhME5uVURoMGFuWnRUMnBrVmxOeVkwaEdSamx4Y1ZKcFRHaDJjV1o2UTBac2J5MXlTRTh3SW4wLmV5Sm5iRzlpWVd4ZmMyVnpjMmx2Ymw5cFpDSTZJak0yTXpaa1ltRXdMV1F5TjJNdE5HVXdZeTFoTXpFNExUSmlabU15Wm1JM1l6VTJaaUlzSW1wMGFTSTZJakU0T0dRNE1XTTFMVGMxTjJFdE5HTXlOeTFpTnpObExXVmpaamM1Wm1RNU1XRTFaaUlzSW1GMWRHaGxiblJwWTJGMGFXOXVYMlYyWlc1MFgybGtJam9pTkRCa05USmpPR1V0TlRaa05pMDBNemt5TFdGa1l6RXRNMlU0WldJM05qazBOR0ZoSWl3aWMyTnZjR1VpT2xzaWIyWm1iR2x1WlY5aFkyTmxjM01pTENKaFkyTnZkVzUwYVc1bkxtRjBkR0ZqYUcxbGJuUnpJaXdpWVdOamIzVnVkR2x1Wnk1MGNtRnVjMkZqZEdsdmJuTWlMQ0poWTJOdmRXNTBhVzVuTG1OdmJuUmhZM1J6SWl3aVlXTmpiM1Z1ZEdsdVp5NXpaWFIwYVc1bmN5SXNJbUZqWTI5MWJuUnBibWN1Y21Wd2IzSjBjeTVpWVc1cmMzVnRiV0Z5ZVNJc0ltRmpZMjkxYm5ScGJtY3VjbVZ3YjNKMGN5NXlaV0ZrSWl3aVlXTmpiM1Z1ZEdsdVp5SXNJbTl3Wlc1cFpDSXNJbkJ5YjJacGJHVWlMQ0psYldGcGJDSmRMQ0pwYzNNaU9pSm9kSFJ3Y3pvdkwybGtaVzUwYVhSNUxuaGxjbTh1WTI5dEwzUnZhMlZ1SWl3aWMzVmlJam9pT0RNM1pqZGpPVGd0T1dNeU5pMDBNelJrTFdKallUZ3ROamN5TldNd04yUTJNVEkzSWl3aVlYVjBhRjkwYVcxbElqb3hOek14T1RjNU1EWXhMQ0pzYVhOMFgybGtJam9pTlRFNFkyUTVOVGd0WkRoaU5TMDBPRFZsTFdGa1l6VXRZbUZrWlRoaE1HSTBNV1VpTENKMFpXNWhiblJmYm1GdFpTSTZJa0l1SUM0Z1NHRjFiR2xsY25NaUxDSjBaVzVoYm5SZmFXUWlPaUl5TkdZM1l6Y3pZeTAzWVRVekxUUXdOekl0WVdZeE5pMWlOV05oWVdNek5ERmlZbVFpTENKalpHaHViM1JwWm5raU9pSTRNemRtTjJNNU9DMDVZekkyTFRRek5HUXRZbU5oT0MwMk56STFZekEzWkRZeE1qZGZYMlJsYm05MGFXZG9MV05jZFRBd01qaDFZVzluY1daeE1FUlZRalU0Y1doWlYxaERNR3R3UzNOVFpFeEJJaXdpZEhsd1pTSTZJbUZqWTJWemMxOTBiMnRsYmlJc0ltbGhkQ0k2TVRZNU16azRNakl6TVN3aVpYaHdJam94Tmprek9UZ3pPRE14TENKdVltWWlPakUyT1RNNU9ESXlNekFzSW1wMGFTSTZJamswWTJKalpUVTFMV1F5TldJdE5HVmlaQzA0T0RNeExUaGpOVFE0TVRBeU1UTmxZaUo5LlBNVERHUjRIN0dOdkl3RWloSDJRaGEyb2dpUjJlbHV2ZEJDeFcxX1VRTDJaLWJmbkI2aFdlTy0xN3BPV1FUQVhCT3RJZ21oekVDa0lGNlJJcURNZkNTbThQa3RxaGFCRDk3a3FlWjN3VDRqZ2hJcGdOSjBsOWJrOXdYNFBKT2dOLW1VRVhrVXJsQVd1QlF0X2plOGVZa01DQU5jUmUxcnBaWjJOdDZnWHhJSm42bFJFVTBHUzFMcTBYN2MyeVlBNUtkUEJGckJCNXhBdUpwSW9pMzg0d1NMN0k1aEVod2J1R0xzcGc1bmdTdllRREwzbThjU0RUbzJmbXJiTlJkYkM0eUxyYUNBb2RCcWJMa3ktdXQ2cUs3WjBzTWxXdEplOFFicnNkdl9jUFc2YjNBcnBRMGoxeHJJa2w2MFV3c2FLQUdGRjJTNWJvUDlGaWxxdHhFa1EiLCJyZWZyZXNoVG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0ltdHBaQ0k2SWpGRFFqYzJSa1kzUkRJeU5UWkRRakE1UXpoQ09VRTNSRGMyTnpZMU56ZzBNekEwT0VNMU9UUWlMQ0owZVhBaU9pSktWMVFpTENKNE5YUWlPaUpTYTBOblVEaDBhblp0VDJwa1ZsTnlZMGhHUmpseFkxSnBUR2gyY1daNlEwWnNieTF5U0U4d0luMC5leUpuYkc5aVlXeGZjMlZ6YzJsdmJsOXBaQ0k2SWpNMk16WmtZbUV3TFdReU4yTXROR1V3WXkxaE16RTRMVEppWm1NeVptSTNZelUyWmlJc0ltcDBhU0k2SW1NNE1tTTVPV016TFdRME1qY3ROR0V6WmkxaE1UVTRMVFJtWXpSaE1qazBZVE0zTkNJc0ltRjFkR2hsYm5ScFkyRjBhVzl1WDJWMlpXNTBYMmxrSWpvaU5EQmtOVEpqT0dVdE5UWmtOaTAwTXpreUxXRmtZekV0TTJVNFNXSTNNVFU1TkRSaFlTSXNJbk5qYjNCbElqcGJJbkpsWm5KbGMyZ2lMQ0p2Wm1ac2FXNWxYMkZqWTJWemN5SXNJbTl3Wlc1cFpDSXNJbUZqWTI5MWJuUnBibWN1YzJWMGRHbHVaM01pTENKaFkyTnZkVzUwYVc1bkxuSmxjRzl5ZEhNdWNtVmhaQ0lzSW1GalkyOTFiblJwYm1jdWNtVndiM0owY3k1aVlXNXJjM1Z0YldGeWVTSXNJbUZqWTI5MWJuUnBibWN1WVhSMFlXTm9iV1Z1ZEhNaUxDSmhZMk52ZFc1MGFXNW5MblJ5WVc1ellXTjBhVzl1Y3lJc0ltRmpZMjkxYm5ScGJtY3VZMjl1ZEdGamRITWlMQ0poWTJOdmRXNTBhVzVuSWl3aWNISnZabWxzWlNJc0ltVnRZV2xzSWwwc0ltbHpjeUk2SW1oMGRIQnpPaTh2YVdSbGJuUnBkSGt1ZUdWeWJ5NWpiMjB2ZEc5clpXNGlMQ0p6ZFdJaU9pSTRNemRtTjJNNU9DMDVZekkyTFRRek5HUXRZbU5oT0MwMk56STFZekEzWkRZeE1qY2lMQ0poZFhSb1gzUnBiV1VpT2pFMk9UTTVPREl5TXpFc0lteHBjM1JmYVdRaU9pSTFNVGhqWkRrMU9DMWtPR0kxTFRRNE5XVXRZV1JqTlMxaVlXUmxPR0V3WWpReFpTSXNJblJsYm1GdWRGOXVZVzFsSWpvaVFpNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUVUxS1FVUkJSQ0JOVVZSTUlpd2lkR1Z1WVc1MFgybGtJam9pTWpSbU4yTTNNMk10TjJFMU15MDBNRGN5TFdGbU1UWXRZalZqWVdGak16UXhZbUprSWl3aVkyUm9ibTkwYVdaNUlqb2lPRE0zWmpkak9UZ3RPV015Tmkwek5HUXRZbU5oT0MwMk56STFZekEzWkRZeE1qZGZYMlJsYm05MGFXZG9MV05jZFRBd01qaDFZVzluY1daeE1FUlZRalU0Y1doWlYxaERNR3R3UzNOVFpFeEJJaXdpZEhsd1pTSTZJblJsYm1GeU5GOWhaR1JwZEdsdmJtRnNYMkYxZEhndmNtVm1jbVZ6YUY5MGIydGxiaUlzSW1saGRDSTZNVFk1TXprNE1qSXpNU3dpWlhod0lqb3hOakkxTkRVek1ETXhMQ0p1WW1ZaU9qRTJPVE01T0RJeU16QXNJbXAwYVNJNkltTTRNbU01T1dNekxXUTBNamN0TkdFelpTMWhNVFU0TFRSbVl6UmhNamswWVRNM05DSjkudC1wd2JGT0xhczNNWmhTU3lCWk5lT2dGSlRXTEZoQlBOcGRWa0R6MW1WR1p4ZVl3MGQ3UmtIRnF6T04ycURyblJBTm9xWFVyZUhUYUh3VU9zRVRaN3RlLWRZNWJsVW5uYjgzeTVhcWc1WFBFY1h0c1JVY1FDbU1GYXo0ZUFnOGdUeTI3bHo5R0Z4U1B0SVgzMFJROUJwMTdBdl9HRF9uYUEtdTNwdEZ3QU9IdjQtV0J4MXFrN1ljaXJ6QVRMTEwyNHA4dWo4TlotdlN6U1Bwb1A1V09aQTZZcUZqOHptaGRSc2ZFY1NTUGNKU2RDRmplR2RfYjNfUjNLN0dzOTVqTXowY0c1SGJQQ3JfTlRidjBuQjJtSDZ2TFFfYUFKa1BMRU9zdnRaQXVOejdnc0dpMHN1clpCUXRJajBGODJaSktuLTd0Nkx0Y19HTXJJaFowdUw3QU1nIiwidGVuYW50SWQiOiIyNGY3YzczYy03YTUzLTQwNzItYWYxNi1iNWNhYWMzNDFiYmQiLCJpYXQiOjE3MzE5NzkyMzQsImV4cCI6MTczMTk4MTAzNH0.oYOcGO_aPv7cKiukfZDsm-Bv0CRcuX7UPM5VWciRuao';
  
  console.log('Decoding JWT token...\n');
  
  // Decode without verification (since we don't have the secret)
  const decoded = jwt.decode(jwtToken) as any;
  
  console.log('JWT Payload:');
  console.log('- Tenant ID:', decoded.tenantId);
  console.log('- Issued at:', new Date(decoded.iat * 1000).toISOString());
  console.log('- Expires at:', new Date(decoded.exp * 1000).toISOString());
  
  // Extract the Xero access token
  const xeroAccessToken = decoded.accessToken;
  console.log('\nXero Access Token extracted (first 50 chars):', xeroAccessToken.substring(0, 50) + '...');
  
  // Now test directly with Xero API
  console.log('\n---\nTesting direct Xero API call for Cash Flow Statement...');
  
  try {
    const xeroResponse = await axios.get(
      'https://api.xero.com/api.xro/2.0/Reports/CashFlowStatement',
      {
        params: {
          fromDate: '2025-05-01',
          toDate: '2025-05-31'
        },
        headers: {
          'Authorization': `Bearer ${xeroAccessToken}`,
          'Accept': 'application/json',
          'Xero-tenant-id': decoded.tenantId
        }
      }
    );
    
    console.log('✅ Direct Xero API Response received');
    const xeroData = xeroResponse.data;
    
    // Write the raw Xero response
    fs.writeFileSync(
      path.join(process.cwd(), 'scripts', 'xero-direct-cash-flow-may-2025.json'),
      JSON.stringify(xeroData, null, 2)
    );
    
    // Parse the Xero cash flow structure
    if (xeroData.Reports && xeroData.Reports.length > 0) {
      const report = xeroData.Reports[0];
      console.log('\nReport Title:', report.ReportTitle);
      console.log('Report Date:', report.ReportDate);
      
      // Look for closing balance in the rows
      if (report.Rows) {
        for (const row of report.Rows) {
          if (row.Title && row.Title.toLowerCase().includes('closing')) {
            console.log('\nFound closing row:', row.Title);
            if (row.Rows && row.Rows.length > 0) {
              for (const subRow of row.Rows) {
                if (subRow.Cells) {
                  console.log('Closing values:', subRow.Cells.map((c: any) => c.Value));
                }
              }
            }
          }
        }
      }
    }
    
    // Also test April 2025
    console.log('\n---\nTesting April 2025 direct Xero API...');
    const aprilResponse = await axios.get(
      'https://api.xero.com/api.xro/2.0/Reports/CashFlowStatement',
      {
        params: {
          fromDate: '2025-04-01',
          toDate: '2025-04-30'
        },
        headers: {
          'Authorization': `Bearer ${xeroAccessToken}`,
          'Accept': 'application/json',
          'Xero-tenant-id': decoded.tenantId
        }
      }
    );
    
    console.log('✅ April 2025 Direct Xero API Response received');
    fs.writeFileSync(
      path.join(process.cwd(), 'scripts', 'xero-direct-cash-flow-april-2025.json'),
      JSON.stringify(aprilResponse.data, null, 2)
    );
    
  } catch (error: any) {
    console.error('❌ Error calling Xero API directly:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
decodeAndTest();