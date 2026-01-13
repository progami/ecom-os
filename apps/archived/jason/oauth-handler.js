const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/oauth2callback') {
    // Extract the authorization code
    const code = parsedUrl.query.code;
    const state = parsedUrl.query.state;
    
    if (code) {
      // Success response
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Authorization Successful</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .success { color: green; font-size: 24px; margin-bottom: 20px; }
              .info { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; }
              code { background: #e0e0e0; padding: 2px 5px; border-radius: 3px; }
            </style>
          </head>
          <body>
            <div class="success">✓ Authorization Successful!</div>
            <div class="info">
              <p>You have successfully authorized the application.</p>
              <p>You can now close this window and return to your terminal.</p>
              <p><small>Authorization code: <code>${code.substring(0, 20)}...</code></small></p>
            </div>
          </body>
        </html>
      `);
      
      console.log('\n✓ OAuth authorization received!');
      console.log('State:', state);
      console.log('Code:', code);
      console.log('\nYou can now close this server and retry your calendar command.\n');
    } else {
      // Error response
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Error: No authorization code received</h1></body></html>');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>404 Not Found</h1></body></html>');
  }
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`\n🚀 OAuth callback handler running on http://localhost:${PORT}`);
  console.log('Waiting for OAuth callback...');
  console.log('\nNow please:\n1. Go back to Claude and retry the calendar authorization\n2. Complete the Google authorization in your browser\n3. You should be redirected back here\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down OAuth handler...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});