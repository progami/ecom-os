#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Generating SSL certificates for Jason app...${NC}"

# Create certificates directory if it doesn't exist
mkdir -p certificates

# Generate a new private key for localhost
echo -e "${YELLOW}Generating private key...${NC}"
openssl genrsa -out certificates/localhost-key.pem 2048

# Generate a certificate signing request
echo -e "${YELLOW}Creating certificate request...${NC}"
openssl req -new -key certificates/localhost-key.pem -out certificates/localhost.csr \
  -subj "/C=US/ST=California/L=San Francisco/O=Jason App/CN=localhost"

# Create a config file for certificate extensions
cat > certificates/localhost.ext <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate the certificate using the CA
echo -e "${YELLOW}Generating certificate...${NC}"
openssl x509 -req -in certificates/localhost.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out certificates/localhost.pem -days 365 \
  -extfile certificates/localhost.ext

# Clean up
rm certificates/localhost.csr certificates/localhost.ext

echo -e "${GREEN}✅ SSL certificates generated successfully!${NC}"
echo ""
echo -e "${YELLOW}To trust the certificate on macOS:${NC}"
echo "1. Run: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certificates/localhost.pem"
echo "2. Enter your password when prompted"
echo "3. Restart your browser"
echo ""
echo -e "${YELLOW}Alternative method (using Keychain Access):${NC}"
echo "1. Open Keychain Access app"
echo "2. Drag certificates/localhost.pem to the System keychain"
echo "3. Double-click the certificate and set to 'Always Trust'"
echo "4. Restart your browser"