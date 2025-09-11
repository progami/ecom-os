#!/bin/bash
echo "Adding localhost certificate to trusted certificates..."
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certificates/localhost.pem
echo "Certificate trusted! Please restart Chrome."