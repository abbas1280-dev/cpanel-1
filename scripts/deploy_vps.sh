#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " Starting Sitechai cPanel Live Production VPS Deployment "
echo "=========================================================="

# 1. Update and install base packages
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y git curl wget unzip nginx mariadb-server php-fpm php-mysql php-mbstring php-zip php-gd php-json php-curl

# 2. Install Node.js 20 LTS
if ! command -v node &> /dev/null; then
    echo "[+] Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "[+] Node version: $(node -v), NPM version: $(npm -v)"

# 3. Setup and secure MariaDB
echo "[+] Configuring MariaDB Server..."
sudo systemctl start mariadb || sudo service mariadb start
sudo systemctl enable mariadb || true

# Set root credentials and cpanel_admin
sudo mariadb -u root << 'EOSQL'
CREATE USER IF NOT EXISTS 'cpanel_admin'@'localhost' IDENTIFIED BY 'SitechaiCpanel_2026_Secured';
CREATE USER IF NOT EXISTS 'cpanel_admin'@'127.0.0.1' IDENTIFIED BY 'SitechaiCpanel_2026_Secured';
CREATE USER IF NOT EXISTS 'cpanel_admin'@'%' IDENTIFIED BY 'SitechaiCpanel_2026_Secured';
GRANT ALL PRIVILEGES ON *.* TO 'cpanel_admin'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'cpanel_admin'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'cpanel_admin'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EOSQL

# 4. Install phpMyAdmin 5.2.x if missing
if [ ! -d "/usr/share/phpmyadmin" ]; then
    echo "[+] Installing phpMyAdmin..."
    sudo apt-get install -y phpmyadmin || {
        wget -q https://files.phpmyadmin.net/phpMyAdmin/5.2.1/phpMyAdmin-5.2.1-all-languages.zip -O /tmp/pma.zip
        sudo unzip -q /tmp/pma.zip -d /usr/share/
        sudo mv /usr/share/phpMyAdmin-5.2.1-all-languages /usr/share/phpmyadmin
        rm -f /tmp/pma.zip
    }
fi

# Configure phpMyAdmin Nginx virtual host on port 8080
sudo mkdir -p /etc/phpmyadmin/conf.d
sudo bash -c 'cat > /etc/phpmyadmin/conf.d/01-sso.php' << 'EOF'
<?php
$i++;
$cfg['Servers'][$i]['auth_type'] = 'signon';
$cfg['Servers'][$i]['SignonSession'] = 'SignonSession';
$cfg['Servers'][$i]['SignonURL'] = 'sso.php';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '3306';
$cfg['Servers'][$i]['connect_type'] = 'tcp';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;
EOF

PHP_SOCK=$(find /run/php/ -name "php*-fpm.sock" | head -n 1)

sudo bash -c "cat > /etc/nginx/sites-available/phpmyadmin.conf" << EOF
server {
    listen 8080;
    server_name _;
    root /usr/share/phpmyadmin;
    index index.php index.html;

    location / {
        try_files \$uri \$uri/ /index.php\$is_args\$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_SOCK};
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/phpmyadmin.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx || sudo service nginx reload

# 5. Clone or update repository
REPO_DIR="$HOME/cpanel-1"
if [ ! -d "$REPO_DIR" ]; then
    echo "[+] Cloning repository from GitHub..."
    git clone https://github.com/abbas1280-dev/cpanel-1.git "$REPO_DIR"
    cd "$REPO_DIR"
else
    echo "[+] Updating repository..."
    cd "$REPO_DIR"
    git pull origin main
fi

# 6. Install dependencies and build frontend
echo "[+] Installing NPM dependencies..."
npm install

echo "[+] Deploying sso.php to phpMyAdmin..."
sudo cp "$REPO_DIR/scripts/sso.php" /usr/share/phpmyadmin/sso.php
sudo chmod 644 /usr/share/phpmyadmin/sso.php

# 7. Start application via PM2
echo "[+] Setting up process supervisor (PM2)..."
sudo npm install -g pm2
pm2 delete cpanel-app 2>/dev/null || true
pm2 start "npx vite --port 5173 --host 0.0.0.0" --name "cpanel-app"
pm2 save

echo "=========================================================="
echo " Deployment Successfully Completed! "
echo "=========================================================="
