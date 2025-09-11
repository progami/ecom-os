#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm i -g pm2 pnpm
systemctl enable nginx
systemctl start nginx
echo "User data setup complete" | tee /var/log/user-data.log

