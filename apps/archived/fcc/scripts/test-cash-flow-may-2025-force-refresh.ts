import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import https from 'https';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testCashFlowAPI() {
  console.log('Testing Cash Flow API for May 2025 with force refresh...\n');
  
  // The token from the browser OAuth that worked
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NUb2tlbiI6ImV5SmhiR2NpT2lKU1V6STFOaUlzSW10cFpDSTZJakZEUWpjMlJrWTNSREl5TlRaRFFqQTVRemhDT1VFM1JEYzJOelkxTnpnME16QTBPRU0xT1RRaUxDSjBlWEFpT2lKS1YxUWlMQ0o0TlhRaU9pSlNhME5uVURoMGFuWnRUMnBrVmxOeVkwaEdSamx4Y1ZKcFRHaDJjV1o2UTBac2J5MXlTRTh3SW4wLmV5Sm5iRzlpWVd4ZmMyVnpjMmx2Ymw5cFpDSTZJak0yTXpaa1ltRXdMV1F5TjJNdE5HVXdZeTFoTXpFNExUSmlabU15Wm1JM1l6VTJaaUlzSW1wMGFTSTZJakU0T0dRNE1XTTFMVGMxTjJFdE5HTXlOeTFpTnpObExXVmpaamM1Wm1RNU1XRTFaaUlzSW1GMWRHaGxiblJwWTJGMGFXOXVYMlYyWlc1MFgybGtJam9pTkRCa05USmpPR1V0TlRaa05pMDBNemt5TFdGa1l6RXRNMlU0WldJM05qazBOR0ZoSWl3aWMyTnZjR1VpT2xzaWIyWm1iR2x1WlY5aFkyTmxjM01pTENKaFkyTnZkVzUwYVc1bkxtRjBkR0ZqYUcxbGJuUnpJaXdpWVdOamIzVnVkR2x1Wnk1MGNtRnVjMkZqZEdsdmJuTWlMQ0poWTJOdmRXNTBhVzVuTG1OdmJuUmhZM1J6SWl3aVlXTmpiM1Z1ZEdsdVp5NXpaWFIwYVc1bmN5SXNJbUZqWTI5MWJuUnBibWN1Y21Wd2IzSjBjeTVpWVc1cmMzVnRiV0Z5ZVNJc0ltRmpZMjkxYm5ScGJtY3VjbVZ3YjNKMGN5NXlaV0ZrSWl3aVlXTmpiM1Z1ZEdsdVp5SXNJbTl3Wlc1cFpDSXNJbkJ5YjJacGJHVWlMQ0psYldGcGJDSmRMQ0pwYzNNaU9pSm9kSFJ3Y3pvdkwybGtaVzUwYVhSNUxuaGxjbTh1WTI5dEwzUnZhMlZ1SWl3aWMzVmlJam9pT0RNM1pqZGpPVGd0T1dNeU5pMDBNelJrTFdKallUZ3ROamN5TldNd04yUTJNVEkzSWl3aVlYVjBhRjkwYVcxbElqb3hOek14T1RjNU1EWXhMQ0pzYVhOMFgybGtJam9pTlRFNFkyUTVOVGd0WkRoaU5TMDBPRFZsTFdGa1l6VXRZbUZrWlRoaE1HSTBNV1VpTENKMFpXNWhiblJmYm1GdFpTSTZJa0l1SUM0Z1NHRjFiR2xsY25NaUxDSjBaVzVoYm5SZmFXUWlPaUl5TkdZM1l6Y3pZeTAzWVRVekxUUXdOekl0WVdZeE5pMWlOV05oWVdNek5ERmlZbVFpTENKalpHaHViM1JwWm5raU9pSTRNemRtTjJNNU9DMDVZekkyTFRRek5HUXRZbU5oT0MwMk56STFZekEzWkRZeE1qZGZYMlJsYm05MGFXZG9MV05jZFRBd01qaDFZVzluY1daeE1FUlZRalU0Y1doWlYxaERNR3R3UzNOVFpFeEJJaXdpZEhsd1pTSTZJbUZqWTJWemMxOTBiMnRsYmlJc0ltbGhkQ0k2TVRZNU16azRNakl6TVN3aVpYaHdJam94Tmprek9UZ3pPRE14TENKdVltWWlPakUyT1RNNU9ESXlNekFzSW1wMGFTSTZJamswWTJKalpUVTFMV1F5TldJdE5HVmlaQzA0T0RNeExUaGpOVFE0TVRBeU1UTmxZaUo5LlBNVERHUjRIN0dOdkl3RWloSDJRaGEyb2dpUjJlbHV2ZEJDeFcxX1VRTDJaLWJmbkI2aFdlTy0xN3BPV1FUQVhCT3RJZ21oekVDa0lGNlJJcURNZkNTbThQa3RxaGFCRDk3a3FlWjN3VDRqZ2hJcGdOSjBsOWJrOXdYNFBKT2dOLW1VRVhrVXJsQVd1QlF0X2plOGVZa01DQU5jUmUxcnBaWjJOdDZnWHhJSm42bFJFVTBHUzFMcTBYN2MyeVlBNUtkUEJGckJCNXhBdUpwSW9pMzg0d1NMN0k1aEVod2J1R0xzcGc1bmdTdllRREwzbThjU0RUbzJmbXJiTlJkYkM0eUxyYUNBb2RCcWJMa3ktdXQ2cUs3WjBzTWxXdEplOFFicnNkdl9jUFc2YjNBcnBRMGoxeHJJa2w2MFV3c2FLQUdGRjJTNWJvUDlGaWxxdHhFa1EiLCJyZWZyZXNoVG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0ltdHBaQ0k2SWpGRFFqYzJSa1kzUkRJeU5UWkRRakE1UXpoQ09VRTNSRGMyTnpZMU56ZzBNekEwT0VNMU9UUWlMQ0owZVhBaU9pSktWMVFpTENKNE5YUWlPaUpTYTBOblVEaDBhblp0VDJwa1ZsTnlZMGhHUmpseFkxSnBUR2gyY1daNlEwWnNieTF5U0U4d0luMC5leUpuYkc5aVlXeGZjMlZ6YzJsdmJsOXBaQ0k2SWpNMk16WmtZbUV3TFdReU4yTXROR1V3WXkxaE16RTRMVEppWm1NeVptSTNZelUyWmlJc0ltcDBhU0k2SW1NNE1tTTVPV016TFdRME1qY3ROR0V6WmkxaE1UVTRMVFJtWXpSaE1qazBZVE0zTkNJc0ltRjFkR2hsYm5ScFkyRjBhVzl1WDJWMlpXNTBYMmxrSWpvaU5EQmtOVEpqT0dVdE5UWmtOaTAwTXpreUxXRmtZekV0TTJVNFNXSTNNVFU1TkRSaFlTSXNJbk5qYjNCbElqcGJJbkpsWm5KbGMyZ2lMQ0p2Wm1ac2FXNWxYMkZqWTJWemN5SXNJbTl3Wlc1cFpDSXNJbUZqWTI5MWJuUnBibWN1YzJWMGRHbHVaM01pTENKaFkyTnZkVzUwYVc1bkxuSmxjRzl5ZEhNdWNtVmhaQ0lzSW1GalkyOTFiblJwYm1jdWNtVndiM0owY3k1aVlXNXJjM1Z0YldGeWVTSXNJbUZqWTI5MWJuUnBibWN1WVhSMFlXTm9iV1Z1ZEhNaUxDSmhZMk52ZFc1MGFXNW5MblJ5WVc1ellXTjBhVzl1Y3lJc0ltRmpZMjkxYm5ScGJtY3VZMjl1ZEdGamRITWlMQ0poWTJOdmRXNTBhVzVuSWl3aWNISnZabWxzWlNJc0ltVnRZV2xzSWwwc0ltbHpjeUk2SW1oMGRIQnpPaTh2YVdSbGJuUnBkSGt1ZUdWeWJ5NWpiMjB2ZEc5clpXNGlMQ0p6ZFdJaU9pSTRNemRtTjJNNU9DMDVZekkyTFRRek5HUXRZbU5oT0MwMk56STFZekEzWkRZeE1qY2lMQ0poZFhSb1gzUnBiV1VpT2pFMk9UTTVPREl5TXpFc0lteHBjM1JmYVdRaU9pSTFNVGhqWkRrMU9DMWtPR0kxTFRRNE5XVXRZV1JqTlMxaVlXUmxPR0V3WWpReFpTSXNJblJsYm1GdWRGOXVZVzFsSWpvaVFpNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUVUxS1FVUkJSQ0JOVVZSTUlpd2lkR1Z1WVc1MFgybGtJam9pTWpSbU4yTTNNMk10TjJFMU15MDBNRGN5TFdGbU1UWXRZalZqWVdGak16UXhZbUprSWl3aVkyUm9ibTkwYVdaNUlqb2lPRE0zWmpkak9UZ3RPV015Tmkwek5HUXRZbU5oT0MwMk56STFZekEzWkRZeE1qZGZYMlJsYm05MGFXZG9MV05jZFRBd01qaDFZVzluY1daeE1FUlZRalU0Y1doWlYxaERNR3R3UzNOVFpFeEJJaXdpZEhsd1pTSTZJblJsYm1GeU5GOWhaR1JwZEdsdmJtRnNYMkYxZEhndmNtVm1jbVZ6YUY5MGIydGxiaUlzSW1saGRDSTZNVFk1TXprNE1qSXpNU3dpWlhod0lqb3hOakkxTkRVek1ETXhMQ0p1WW1ZaU9qRTJPVE01T0RJeU16QXNJbXAwYVNJNkltTTRNbU01T1dNekxXUTBNamN0TkdFelpTMWhNVFU0TFRSbVl6UmhNamswWVRNM05DSjkudC1wd2JGT0xhczNNWmhTU3lCWk5lT2dGSlRXTEZoQlBOcGRWa0R6MW1WR1p4ZVl3MGQ3UmtIRnF6T04ycURyblJBTm9xWFVyZUhUYUh3VU9zRVRaN3RlLWRZNWJsVW5uYjgzeTVhcWc1WFBFY1h0c1JVY1FDbU1GYXo0ZUFnOGdUeTI3bHo5R0Z4U1B0SVgzMFJROUJwMTdBdl9HRF9uYUEtdTNwdEZ3QU9IdjQtV0J4MXFrN1ljaXJ6QVRMTEwyNHA4dWo4TlotdlN6U1Bwb1A1V09aQTZZcUZqOHptaGRSc2ZFY1NTUGNKU2RDRmplR2RfYjNfUjNLN0dzOTVqTXowY0c1SGJQQ3JfTlRidjBuQjJtSDZ2TFFfYUFKa1BMRU9zdnRaQXVOejdnc0dpMHN1clpCUXRJajBGODJaSktuLTd0Nkx0Y19HTXJJaFowdUw3QU1nIiwidGVuYW50SWQiOiIyNGY3YzczYy03YTUzLTQwNzItYWYxNi1iNWNhYWMzNDFiYmQiLCJpYXQiOjE3MzE5NzkyMzQsImV4cCI6MTczMTk4MTAzNH0.oYOcGO_aPv7cKiukfZDsm-Bv0CRcuX7UPM5VWciRuao';
  
  try {
    // Test fetching cash flow for May 2025 with force refresh
    console.log('Fetching May 2025 cash flow with forceRefresh=true...');
    const mayResponse = await axios.get(
      'https://localhost:3003/api/v1/xero/reports/cash-flow',
      {
        params: {
          fromDate: '2025-05-01',
          toDate: '2025-05-31',
          forceRefresh: 'true'  // Force fetch from Xero
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        httpsAgent
      }
    );

    console.log('✅ May 2025 Cash Flow Response received');
    const mayData = mayResponse.data;
    
    console.log('\nResponse metadata:');
    console.log('- Source:', mayData.source);
    console.log('- Period:', mayData.fromDate, 'to', mayData.toDate);
    console.log('- Fetched at:', mayData.fetchedAt);
    
    // Write to file for detailed analysis
    fs.writeFileSync(
      path.join(process.cwd(), 'scripts', 'cash-flow-may-2025-forced.json'),
      JSON.stringify(mayData, null, 2)
    );
    
    // Check the values
    console.log('\nCash Flow Summary:');
    console.log('- Opening Balance:', mayData.openingBalance || mayData.summary?.openingBalance);
    console.log('- Closing Balance:', mayData.closingBalance || mayData.summary?.closingBalance);
    console.log('- Net Cash Flow:', mayData.totalNetCashFlow || mayData.summary?.netCashFlow);
    
    console.log('\nExpected values:');
    console.log('- May 2025 closing balance: £179,272.78');
    console.log('- April 2025 closing balance: £182,387.67');
    
    // Also test April 2025 with force refresh
    console.log('\n---\nFetching April 2025 cash flow with forceRefresh=true...');
    const aprilResponse = await axios.get(
      'https://localhost:3003/api/v1/xero/reports/cash-flow',
      {
        params: {
          fromDate: '2025-04-01',
          toDate: '2025-04-30',
          forceRefresh: 'true'
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        httpsAgent
      }
    );

    console.log('✅ April 2025 Cash Flow Response received');
    const aprilData = aprilResponse.data;
    
    console.log('\nApril Response metadata:');
    console.log('- Source:', aprilData.source);
    console.log('- Period:', aprilData.fromDate, 'to', aprilData.toDate);
    
    // Write to file
    fs.writeFileSync(
      path.join(process.cwd(), 'scripts', 'cash-flow-april-2025-forced.json'),
      JSON.stringify(aprilData, null, 2)
    );
    
    console.log('\nApril Cash Flow Summary:');
    console.log('- Opening Balance:', aprilData.openingBalance || aprilData.summary?.openingBalance);
    console.log('- Closing Balance:', aprilData.closingBalance || aprilData.summary?.closingBalance);
    console.log('- Net Cash Flow:', aprilData.totalNetCashFlow || aprilData.summary?.netCashFlow);
    
  } catch (error: any) {
    console.error('❌ Error testing cash flow API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testCashFlowAPI();