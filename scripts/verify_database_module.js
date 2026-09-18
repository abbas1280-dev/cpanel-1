import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:5173';
const DOMAIN = 'turkyhub.com';

async function runTests() {
  console.log('========================================================');
  console.log('STARTING DATABASE MODULE & PHPMYADMIN SSO VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    process.stdout.write(`Test ${total}: ${name} ... `);
    try {
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (e) {
      console.log('FAILED ✗');
      console.error('  Error:', e.message || e);
    }
  }

  // 1. Server Status
  await test('MariaDB Server Health Check (/status)', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/status`);
    const data = await res.json();
    if (!data.online) throw new Error('MariaDB status returned offline');
    if (!data.version) throw new Error('Missing MariaDB version');
  });

  // 2. Create Database
  const testSuffix = 'test_' + Math.floor(Math.random() * 1000);
  let createdDbName = '';

  await test('Create Real Database in MariaDB', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, dbName: testSuffix, collation: 'utf8mb4_unicode_ci' })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create database');
    createdDbName = data.database;
  });

  // 3. List Databases
  await test('List Databases & Verify Created Database', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/list?domain=${DOMAIN}`);
    const data = await res.json();
    if (!data.success) throw new Error('Failed to list databases');
    const found = data.databases.some(d => d.name === createdDbName);
    if (!found) throw new Error(`Created database ${createdDbName} not found in listing`);
  });

  // 4. Check Database
  await test('Check Database Integrity (CHECK TABLE)', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, database: createdDbName })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to check database');
  });

  // 5. Repair Database
  await test('Repair Database (REPAIR TABLE)', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, database: createdDbName })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to repair database');
  });

  // 6. Create Database User
  const testUserSuffix = 'u_' + Math.floor(Math.random() * 1000);
  let createdUsername = '';
  const testUserPass = 'StrongUserPass_2026!';

  await test('Create Database User with Password', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, username: testUserSuffix, password: testUserPass })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create user');
    createdUsername = data.username;
  });

  // 7. Grant Privileges
  await test('Assign User to Database with Granular Privileges', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/privileges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: DOMAIN,
        database: createdDbName,
        username: createdUsername,
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP']
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to set privileges');
  });

  // 8. Get Privileges
  await test('Inspect Assigned Privileges from MariaDB', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/privileges?domain=${DOMAIN}&database=${createdDbName}&username=${createdUsername}`);
    const data = await res.json();
    if (!data.success) throw new Error('Failed to get privileges');
    if (!data.privileges || data.privileges.length === 0) throw new Error('Privileges array is empty');
  });

  // 9. Change Password
  await test('Change User Password in MariaDB', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/users/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, username: createdUsername, newPassword: 'UpdatedUserPass_2026!' })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to change password');
  });

  // 10. phpMyAdmin SSO Generation & Real Login Verification
  await test('Generate phpMyAdmin SSO Ticket & Follow Session Login', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/phpmyadmin-sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, database: createdDbName })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to generate SSO ticket');
    if (!data.ssoUrl) throw new Error('Missing ssoUrl');

    // Follow the sso.php redirect
    const curlOut = execSync(`curl.exe -i -s "${data.ssoUrl}"`, { encoding: 'utf-8' });
    if (!curlOut.includes('HTTP/1.1 302 Found') && !curlOut.includes('Location: index.php')) {
      throw new Error('sso.php did not return 302 redirect: ' + curlOut.slice(0, 200));
    }
  });

  // 11. Rename Database
  const renamedSuffix = testSuffix + 'r';
  let renamedDbName = '';
  await test('Rename Database in MariaDB', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, oldDatabase: createdDbName, newDatabaseSuffix: renamedSuffix })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to rename database');
    renamedDbName = data.newDatabase;
  });

  // 12. Cleanup: Delete User & Delete Database
  await test('Delete User from MariaDB', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/users/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, username: createdUsername })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete user');
  });

  await test('Delete Renamed Database from MariaDB', async () => {
    const res = await fetch(`${BASE_URL}/api/cpanel/databases/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: DOMAIN, database: renamedDbName })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete database');
  });

  console.log('\n========================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} / ${total} TESTS PASSED`);
  console.log('========================================================');
  if (passed === total) {
    console.log('ALL MODULE ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
