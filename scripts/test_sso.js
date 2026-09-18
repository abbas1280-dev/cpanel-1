import mysql from 'mysql2/promise';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';

async function testSSO() {
  console.log('1. Connecting to MariaDB to ensure user exists...');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'cpanel_admin',
    password: 'SitechaiCpanel_2026_Secured'
  });

  const accountUser = 'turkyhu1';
  const testPass = 'SitechaiPass_2026_SSO!';
  
  // Ensure account user exists with localhost & 127.0.0.1 access
  await conn.query(`CREATE USER IF NOT EXISTS '${accountUser}'@'localhost' IDENTIFIED BY '${testPass}'`);
  await conn.query(`CREATE USER IF NOT EXISTS '${accountUser}'@'127.0.0.1' IDENTIFIED BY '${testPass}'`);
  await conn.query(`ALTER USER '${accountUser}'@'localhost' IDENTIFIED BY '${testPass}'`);
  await conn.query(`ALTER USER '${accountUser}'@'127.0.0.1' IDENTIFIED BY '${testPass}'`);
  await conn.query(`GRANT ALL PRIVILEGES ON \`${accountUser}\\_%\`.* TO '${accountUser}'@'localhost'`);
  await conn.query(`GRANT ALL PRIVILEGES ON \`${accountUser}\\_%\`.* TO '${accountUser}'@'127.0.0.1'`);
  await conn.query('FLUSH PRIVILEGES');
  console.log(`MariaDB user ${accountUser} configured!`);
  await conn.end();

  // 2. Generate a secure SSO token
  const token = crypto.randomBytes(32).toString('hex');
  const ticket = {
    user: accountUser,
    password: testPass,
    database: 'turkyhu1_db',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000
  };

  const ticketJson = JSON.stringify(ticket);
  fs.writeFileSync('./scripts/ticket_tmp.json', ticketJson, 'utf-8');
  execSync(`wsl -d Ubuntu -u root cp ./scripts/ticket_tmp.json /tmp/pma_sso_${token}.json`, { stdio: 'inherit' });
  execSync(`wsl -d Ubuntu -u root chmod 644 /tmp/pma_sso_${token}.json`, { stdio: 'inherit' });
  console.log(`Ticket written to WSL /tmp/pma_sso_${token}.json`);

  // 3. Test HTTP GET to sso.php
  const ssoUrl = `http://localhost:8080/sso.php?token=${token}&db=turkyhu1_db`;
  console.log(`Testing SSO endpoint: ${ssoUrl}`);
  
  const curlOut = execSync(`curl.exe -i -s "${ssoUrl}"`, { encoding: 'utf-8' });
  console.log('CURL OUTPUT:');
  console.log(curlOut.slice(0, 500));
}

testSSO().catch(console.error);
