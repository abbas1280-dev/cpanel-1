const crypto = require('crypto');
const mysql = require('mysql2/promise');

const accountPrefix = 'turkyhu1';
const secretSeed = `sitechai_pma_sso_${accountPrefix}_2026_secured`;
const accountPassword = crypto.createHash('sha256').update(secretSeed).digest('hex').slice(0, 24) + '!Aa1';

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '172.25.238.28',
      port: 3306,
      user: 'turkyhu1',
      password: accountPassword
    });
    console.log('Successfully connected to MariaDB as turkyhu1!');
    const [dbs] = await conn.query('SHOW DATABASES');
    console.log('Databases visible to turkyhu1:', dbs.map(d => d.Database));
    await conn.end();
  } catch (e) {
    console.error('Connection error for turkyhu1:', e.message);
  }
})();
