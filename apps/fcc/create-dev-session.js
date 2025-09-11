// Development script to create a session
const https = require('https');

const data = JSON.stringify({
  email: 'dev@example.com',
  password: 'dev123'
});

const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/v1/auth/dev-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  rejectUnauthorized: false // Allow self-signed certificate
};

const req = https.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
