import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { execSync } from 'child_process';

// Configuration for administrative connection to live MariaDB
const DB_HOST = process.env.MARIADB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.MARIADB_PORT || '3306', 10);
const DB_ADMIN_USER = process.env.MARIADB_ADMIN_USER || 'cpanel_admin';
const DB_ADMIN_PASSWORD = process.env.MARIADB_ADMIN_PASSWORD || 'SitechaiCpanel_2026_Secured';

let activePool: mysql.Pool | null = null;
let resolvedHost: string | null = null;
let cachedWslIp: string | null = null;

function getWslIp(): string | null {
  if (cachedWslIp) return cachedWslIp;
  if (process.platform === 'win32') {
    try {
      const wslOut = execSync('wsl -d Ubuntu -e hostname -I', { encoding: 'utf-8', timeout: 5000 });
      const ip = wslOut.trim().split(/\s+/)[0];
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        cachedWslIp = ip;
        return ip;
      }
    } catch (e) {}
  }
  return null;
}

export async function getPool(): Promise<mysql.Pool> {
  if (activePool) return activePool;

  const candidateHosts: string[] = [];
  if (resolvedHost) {
    candidateHosts.push(resolvedHost);
  }
  const wslIp = getWslIp();
  if (wslIp && !candidateHosts.includes(wslIp)) {
    candidateHosts.push(wslIp);
  }
  if (!candidateHosts.includes('127.0.0.1')) candidateHosts.push('127.0.0.1');
  if (!candidateHosts.includes('localhost')) candidateHosts.push('localhost');

  for (const host of candidateHosts) {
    try {
      const testConn = await mysql.createConnection({
        host,
        port: DB_PORT,
        user: DB_ADMIN_USER,
        password: DB_ADMIN_PASSWORD,
        connectTimeout: 2000
      });
      await testConn.end();
      resolvedHost = host;
      activePool = mysql.createPool({
        host: resolvedHost,
        port: DB_PORT,
        user: DB_ADMIN_USER,
        password: DB_ADMIN_PASSWORD,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });
      return activePool;
    } catch (e) {}
  }

  // Fallback
  const fallbackHost = resolvedHost || wslIp || DB_HOST;
  activePool = mysql.createPool({
    host: fallbackHost,
    port: DB_PORT,
    user: DB_ADMIN_USER,
    password: DB_ADMIN_PASSWORD,
    waitForConnections: true,
    connectionLimit: 15
  });
  return activePool;
}

export async function getConnection(): Promise<mysql.PoolConnection> {
  try {
    const p = await getPool();
    return await p.getConnection();
  } catch (err) {
    // Reset pool on error and try to re-resolve host
    activePool = null;
    const p = await getPool();
    return await p.getConnection();
  }
}

// Protected System Databases that normal users can NEVER access or drop
export const SYSTEM_DATABASES = new Set([
  'mysql',
  'information_schema',
  'performance_schema',
  'sys',
  'test'
]);

// Standard 18 Privileges matching cPanel standard (Screenshot 1 Reference)
export const SUPPORTED_PRIVILEGES = [
  'ALTER',
  'ALTER ROUTINE',
  'CREATE',
  'CREATE ROUTINE',
  'CREATE TEMPORARY TABLES',
  'CREATE VIEW',
  'DELETE',
  'DROP',
  'EVENT',
  'EXECUTE',
  'INDEX',
  'INSERT',
  'LOCK TABLES',
  'REFERENCES',
  'SELECT',
  'SHOW VIEW',
  'TRIGGER',
  'UPDATE'
] as const;

export type SupportedPrivilege = typeof SUPPORTED_PRIVILEGES[number];

// Storage root for backups
const STORAGE_ROOT = path.resolve(process.cwd(), 'server_storage');

// Manager Session Store (Memory mapped token store for secure 1-click DB manager)
interface ManagerSession {
  token: string;
  domain: string;
  accountPrefix: string;
  database: string;
  createdAt: number;
  expiresAt: number;
}
const managerSessions = new Map<string, ManagerSession>();

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of managerSessions.entries()) {
    if (sess.expiresAt < now) {
      managerSessions.delete(token);
    }
  }
}, 60000);

/**
 * Calculates the unique hosting account prefix for a domain (e.g. turkyhub.com -> turkyh1)
 */
export function getAccountPrefix(domain: string): string {
  if (!domain) return 'user1';
  const clean = domain.split('.')[0].replace(/[^a-z0-9]/gi, '').slice(0, 7).toLowerCase();
  return (clean || 'user') + '1';
}

/**
 * Validates that an identifier only contains alphanumeric characters and underscores
 */
export function validateIdentifier(id: string): boolean {
  return /^[a-zA-Z0-9_]{1,64}$/.test(id);
}

/**
 * Ensures database name belongs to the authorized account prefix
 */
export function assertDatabaseOwnership(accountPrefix: string, fullDbName: string) {
  const lower = fullDbName.toLowerCase();
  if (SYSTEM_DATABASES.has(lower)) {
    throw new Error(`Access Denied: "${fullDbName}" is a protected system database.`);
  }
  const prefix = accountPrefix.toLowerCase() + '_';
  if (!lower.startsWith(prefix)) {
    throw new Error(`Authorization Error: Database "${fullDbName}" does not belong to account prefix "${accountPrefix}".`);
  }
}

/**
 * Ensures database user belongs to the authorized account prefix
 */
export function assertUserOwnership(accountPrefix: string, fullUsername: string) {
  const lower = fullUsername.toLowerCase();
  if (lower === 'root' || lower === 'cpanel_admin' || lower === 'mysql') {
    throw new Error(`Access Denied: Protected administrative user "${fullUsername}".`);
  }
  const prefix = accountPrefix.toLowerCase() + '_';
  if (!lower.startsWith(prefix)) {
    throw new Error(`Authorization Error: Database user "${fullUsername}" does not belong to account prefix "${accountPrefix}".`);
  }
}

/**
 * Validates ownership of database or user resource by account prefix
 */
export function validateOwnership(name: string, accountPrefix: string) {
  const lower = name.toLowerCase();
  if (SYSTEM_DATABASES.has(lower)) {
    throw new Error(`Access Denied: "${name}" is a protected system database.`);
  }
  const prefix = accountPrefix.toLowerCase() + '_';
  if (!lower.startsWith(prefix)) {
    throw new Error(`Authorization Error: Resource "${name}" does not belong to account prefix "${accountPrefix}".`);
  }
}

// =============================================================================
// MARIADB SERVER HEALTH & STATUS
// =============================================================================
export async function getMariaDBStatus() {
  try {
    const conn = await getConnection();
    try {
      const [vRows]: any = await conn.query('SELECT VERSION() as version, @@hostname as hostname, NOW() as server_time');
      const [uRows]: any = await conn.query("SHOW GLOBAL STATUS LIKE 'Uptime'");
      const [connRows]: any = await conn.query("SHOW GLOBAL STATUS LIKE 'Threads_connected'");
      
      const uptimeSec = parseInt(uRows[0]?.Value || '0', 10);
      const uptimeFormatted = formatUptime(uptimeSec);

      return {
        online: true,
        version: vRows[0]?.version || 'MariaDB 11.8',
        serverTime: vRows[0]?.server_time,
        uptime: uptimeFormatted,
        activeConnections: parseInt(connRows[0]?.Value || '1', 10),
        host: DB_HOST,
        port: DB_PORT
      };
    } finally {
      conn.release();
    }
  } catch (e: any) {
    console.error('[MARIADB CONNECTION ERROR]:', e);
    return {
      online: false,
      error: (e && (e.message || e.code)) || 'Unable to connect to MariaDB server',
      host: DB_HOST,
      port: DB_PORT
    };
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds % 60}s`;
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================
export async function listDatabases(accountPrefix: string) {
  const prefix = accountPrefix.toLowerCase() + '_';
  const conn = await getConnection();

  try {
    // Query actual schemas matching user prefix
    const [schemas]: any = await conn.query(
      `SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME 
       FROM information_schema.SCHEMATA 
       WHERE LOWER(SCHEMA_NAME) LIKE ?
       ORDER BY SCHEMA_NAME ASC`,
      [`${prefix}%`]
    );

    // Query table stats and sizes for each database
    const [tableStats]: any = await conn.query(
      `SELECT TABLE_SCHEMA, 
              COUNT(TABLE_NAME) as table_count, 
              COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) as total_bytes
       FROM information_schema.TABLES 
       WHERE LOWER(TABLE_SCHEMA) LIKE ?
       GROUP BY TABLE_SCHEMA`,
      [`${prefix}%`]
    );

    const statsMap = new Map<string, { count: number; bytes: number }>();
    for (const row of tableStats) {
      statsMap.set(row.TABLE_SCHEMA, {
        count: parseInt(row.table_count || '0', 10),
        bytes: parseInt(row.total_bytes || '0', 10)
      });
    }

    // Query user grants associated with these databases
    const [dbGrants]: any = await conn.query(
      `SELECT Db, User, Host 
       FROM mysql.db 
       WHERE LOWER(Db) LIKE ? AND User NOT IN ('root', 'cpanel_admin', 'debian-sys-maint')`,
      [`${prefix}%`]
    );

    const userMap = new Map<string, Set<string>>();
    for (const g of dbGrants) {
      if (!userMap.has(g.Db)) {
        userMap.set(g.Db, new Set());
      }
      userMap.get(g.Db)!.add(g.User);
    }

    return schemas.map((s: any) => {
      const stats = statsMap.get(s.SCHEMA_NAME) || { count: 0, bytes: 0 };
      const assignedUsers = Array.from(userMap.get(s.SCHEMA_NAME) || []);

      return {
        name: s.SCHEMA_NAME,
        charset: s.DEFAULT_CHARACTER_SET_NAME || 'utf8mb4',
        collation: s.DEFAULT_COLLATION_NAME || 'utf8mb4_unicode_ci',
        tablesCount: stats.count,
        sizeBytes: stats.bytes,
        sizeFormatted: formatBytes(stats.bytes),
        assignedUsers: assignedUsers,
        status: 'Active'
      };
    });
  } finally {
    conn.release();
  }
}

export async function createDatabase(accountPrefix: string, dbSuffix: string, charset = 'utf8mb4', collation = 'utf8mb4_unicode_ci') {
  const cleanSuffix = dbSuffix.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleanSuffix) {
    throw new Error('Database name suffix cannot be empty and must contain alphanumeric characters or underscores.');
  }

  const fullDbName = `${accountPrefix.toLowerCase()}_${cleanSuffix}`;
  if (fullDbName.length > 64) {
    throw new Error('Database name exceeds MariaDB 64-character limit.');
  }

  assertDatabaseOwnership(accountPrefix, fullDbName);

  const conn = await getConnection();
  try {
    // Check if database already exists
    const [existing]: any = await conn.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [fullDbName]
    );
    if (existing.length > 0) {
      throw new Error(`Database "${fullDbName}" already exists on the MariaDB server.`);
    }

    // Create database with utf8mb4
    await conn.query(
      `CREATE DATABASE \`${fullDbName}\` CHARACTER SET ${mysql.escapeId(charset).replace(/`/g, '')} COLLATE ${mysql.escapeId(collation).replace(/`/g, '')}`
    );

    return {
      success: true,
      database: fullDbName,
      charset,
      collation
    };
  } finally {
    conn.release();
  }
}

export async function deleteDatabase(accountPrefix: string, fullDbName: string) {
  assertDatabaseOwnership(accountPrefix, fullDbName);

  const conn = await getConnection();
  try {
    // Verify database exists
    const [existing]: any = await conn.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [fullDbName]
    );
    if (existing.length === 0) {
      throw new Error(`Database "${fullDbName}" does not exist.`);
    }

    // Revoke any existing user grants on this database
    try {
      const [grants]: any = await conn.query(
        'SELECT User, Host FROM mysql.db WHERE Db = ?',
        [fullDbName]
      );
      for (const g of grants) {
        try {
          await conn.query(`REVOKE ALL PRIVILEGES ON \`${fullDbName}\`.* FROM '${g.User}'@'${g.Host}'`);
        } catch (e) {}
      }
    } catch (e) {}

    // Drop database
    await conn.query(`DROP DATABASE \`${fullDbName}\``);
    await conn.query('FLUSH PRIVILEGES');

    return {
      success: true,
      database: fullDbName
    };
  } finally {
    conn.release();
  }
}

// =============================================================================
// DATABASE USER OPERATIONS
// =============================================================================
export async function listDatabaseUsers(accountPrefix: string) {
  const prefix = accountPrefix.toLowerCase() + '_';
  const conn = await getConnection();

  try {
    // Query users matching prefix from mysql.user
    const [users]: any = await conn.query(
      `SELECT DISTINCT User 
       FROM mysql.user 
       WHERE LOWER(User) LIKE ? 
         AND User NOT IN ('root', 'cpanel_admin', 'debian-sys-maint')
       ORDER BY User ASC`,
      [`${prefix}%`]
    );

    // Query which databases each user is assigned to
    const [dbGrants]: any = await conn.query(
      `SELECT User, Db 
       FROM mysql.db 
       WHERE LOWER(User) LIKE ?`,
      [`${prefix}%`]
    );

    const userDbs = new Map<string, Set<string>>();
    for (const g of dbGrants) {
      if (!userDbs.has(g.User)) {
        userDbs.set(g.User, new Set());
      }
      userDbs.get(g.User)!.add(g.Db);
    }

    return users.map((u: any) => ({
      username: u.User,
      assignedDatabases: Array.from(userDbs.get(u.User) || []),
      status: 'Active'
    }));
  } finally {
    conn.release();
  }
}

export async function createDatabaseUser(accountPrefix: string, userSuffix: string, password: string) {
  const cleanSuffix = userSuffix.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleanSuffix) {
    throw new Error('Database username suffix cannot be empty.');
  }

  const fullUsername = `${accountPrefix.toLowerCase()}_${cleanSuffix}`;
  if (fullUsername.length > 32) {
    throw new Error('Database username exceeds MariaDB limit of 32 characters.');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  assertUserOwnership(accountPrefix, fullUsername);

  const conn = await getConnection();
  try {
    // Check if user already exists
    const [existing]: any = await conn.query(
      'SELECT User FROM mysql.user WHERE User = ?',
      [fullUsername]
    );
    if (existing.length > 0) {
      throw new Error(`Database user "${fullUsername}" already exists on this server.`);
    }

    // Create user for '%', 'localhost', and '127.0.0.1'
    await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [fullUsername, '%', password]);
    await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [fullUsername, 'localhost', password]);
    await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [fullUsername, '127.0.0.1', password]);
    await conn.query('FLUSH PRIVILEGES');

    return {
      success: true,
      username: fullUsername
    };
  } finally {
    conn.release();
  }
}

export async function changeUserPassword(accountPrefix: string, fullUsername: string, newPassword: string) {
  assertUserOwnership(accountPrefix, fullUsername);

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  const conn = await getConnection();
  try {
    // Update password for both '%' and 'localhost' hosts
    await conn.query('ALTER USER ?@? IDENTIFIED BY ?', [fullUsername, '%', newPassword]);
    try {
      await conn.query('ALTER USER ?@? IDENTIFIED BY ?', [fullUsername, 'localhost', newPassword]);
    } catch (e) {}

    await conn.query('FLUSH PRIVILEGES');

    return {
      success: true,
      username: fullUsername
    };
  } finally {
    conn.release();
  }
}

export async function deleteDatabaseUser(accountPrefix: string, fullUsername: string) {
  assertUserOwnership(accountPrefix, fullUsername);

  const conn = await getConnection();
  try {
    // Revoke all grants
    try {
      await conn.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${fullUsername}'@'%'`);
    } catch (e) {}
    try {
      await conn.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${fullUsername}'@'localhost'`);
    } catch (e) {}

    // Drop user
    await conn.query(`DROP USER IF EXISTS '${fullUsername}'@'%'`);
    await conn.query(`DROP USER IF EXISTS '${fullUsername}'@'localhost'`);
    await conn.query('FLUSH PRIVILEGES');

    return {
      success: true,
      username: fullUsername
    };
  } finally {
    conn.release();
  }
}

// =============================================================================
// PRIVILEGE MANAGEMENT (SCREENSHOT 1 REFERENCE)
// =============================================================================
export async function getDatabasePrivileges(accountPrefix: string, fullDbName: string, fullUsername: string) {
  assertDatabaseOwnership(accountPrefix, fullDbName);
  assertUserOwnership(accountPrefix, fullUsername);

  const conn = await getConnection();
  try {
    // Inspect mysql.db or SHOW GRANTS
    const [dbGrants]: any = await conn.query(
      `SELECT * FROM mysql.db WHERE Db = ? AND User = ?`,
      [fullDbName, fullUsername]
    );

    const activePrivs: Record<string, boolean> = {};
    for (const p of SUPPORTED_PRIVILEGES) {
      activePrivs[p] = false;
    }

    if (dbGrants.length > 0) {
      const g = dbGrants[0];
      // Mapping MariaDB db table columns to standard privilege names
      activePrivs['SELECT'] = g.Select_priv === 'Y';
      activePrivs['INSERT'] = g.Insert_priv === 'Y';
      activePrivs['UPDATE'] = g.Update_priv === 'Y';
      activePrivs['DELETE'] = g.Delete_priv === 'Y';
      activePrivs['CREATE'] = g.Create_priv === 'Y';
      activePrivs['DROP'] = g.Drop_priv === 'Y';
      activePrivs['INDEX'] = g.Index_priv === 'Y';
      activePrivs['ALTER'] = g.Alter_priv === 'Y';
      activePrivs['CREATE TEMPORARY TABLES'] = g.Create_tmp_table_priv === 'Y';
      activePrivs['LOCK TABLES'] = g.Lock_tables_priv === 'Y';
      activePrivs['CREATE VIEW'] = g.Create_view_priv === 'Y';
      activePrivs['SHOW VIEW'] = g.Show_view_priv === 'Y';
      activePrivs['CREATE ROUTINE'] = g.Create_routine_priv === 'Y';
      activePrivs['ALTER ROUTINE'] = g.Alter_routine_priv === 'Y';
      activePrivs['EXECUTE'] = g.Execute_priv === 'Y';
      activePrivs['TRIGGER'] = g.Trigger_priv === 'Y';
      activePrivs['EVENT'] = g.Event_priv === 'Y';
      activePrivs['REFERENCES'] = g.References_priv === 'Y';
    }

    const allSelected = SUPPORTED_PRIVILEGES.every(p => activePrivs[p]);

    return {
      database: fullDbName,
      username: fullUsername,
      allPrivileges: allSelected,
      privileges: activePrivs
    };
  } finally {
    conn.release();
  }
}

export async function setDatabasePrivileges(
  accountPrefix: string,
  fullDbName: string,
  fullUsername: string,
  requestedPrivileges: string[] | 'ALL'
) {
  assertDatabaseOwnership(accountPrefix, fullDbName);
  assertUserOwnership(accountPrefix, fullUsername);

  const conn = await getConnection();
  try {
    const isAll = requestedPrivileges === 'ALL' || (
      Array.isArray(requestedPrivileges) && (
        requestedPrivileges.includes('ALL') ||
        requestedPrivileges.includes('ALL PRIVILEGES') ||
        (requestedPrivileges.length >= SUPPORTED_PRIVILEGES.length && SUPPORTED_PRIVILEGES.every(p => requestedPrivileges.includes(p)))
      )
    );

    // Revoke current grants on this database first for clean recalculation
    try {
      await conn.query(`REVOKE ALL PRIVILEGES ON \`${fullDbName}\`.* FROM '${fullUsername}'@'%'`);
    } catch (e) {}
    try {
      await conn.query(`REVOKE ALL PRIVILEGES ON \`${fullDbName}\`.* FROM '${fullUsername}'@'localhost'`);
    } catch (e) {}
    try {
      await conn.query(`REVOKE ALL PRIVILEGES ON \`${fullDbName}\`.* FROM '${fullUsername}'@'127.0.0.1'`);
    } catch (e) {}

    if (isAll) {
      await conn.query(`GRANT ALL PRIVILEGES ON \`${fullDbName}\`.* TO '${fullUsername}'@'%'`);
      await conn.query(`GRANT ALL PRIVILEGES ON \`${fullDbName}\`.* TO '${fullUsername}'@'localhost'`);
      await conn.query(`GRANT ALL PRIVILEGES ON \`${fullDbName}\`.* TO '${fullUsername}'@'127.0.0.1'`);
    } else if (Array.isArray(requestedPrivileges) && requestedPrivileges.length > 0) {
      // Filter only valid supported privileges to prevent SQL injection
      const validPrivs = requestedPrivileges.filter(p => (SUPPORTED_PRIVILEGES as readonly string[]).includes(p));
      if (validPrivs.length > 0) {
        const privClause = validPrivs.join(', ');
        await conn.query(`GRANT ${privClause} ON \`${fullDbName}\`.* TO '${fullUsername}'@'%'`);
        await conn.query(`GRANT ${privClause} ON \`${fullDbName}\`.* TO '${fullUsername}'@'localhost'`);
        await conn.query(`GRANT ${privClause} ON \`${fullDbName}\`.* TO '${fullUsername}'@'127.0.0.1'`);
      }
    }

    await conn.query('FLUSH PRIVILEGES');

    return await getDatabasePrivileges(accountPrefix, fullDbName, fullUsername);
  } finally {
    conn.release();
  }
}

export async function removeUserFromDatabase(accountPrefix: string, fullDbName: string, fullUsername: string) {
  assertDatabaseOwnership(accountPrefix, fullDbName);
  assertUserOwnership(accountPrefix, fullUsername);

  const conn = await getConnection();
  try {
    try {
      await conn.query(`REVOKE ALL PRIVILEGES ON \`${fullDbName}\`.* FROM '${fullUsername}'@'%'`);
    } catch (e) {}
    try {
      await conn.query(`REVOKE ALL PRIVILEGES ON \`${fullDbName}\`.* FROM '${fullUsername}'@'localhost'`);
    } catch (e) {}

    await conn.query('FLUSH PRIVILEGES');

    return {
      success: true,
      database: fullDbName,
      username: fullUsername
    };
  } finally {
    conn.release();
  }
}

// =============================================================================
// IMPORT / EXPORT & BACKUP / RESTORE
// =============================================================================
export async function exportDatabase(accountPrefix: string, fullDbName: string) {
  assertDatabaseOwnership(accountPrefix, fullDbName);

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${fullDbName}\``);

    let sqlDump = `-- Sitechai MariaDB Database Export\n-- Database: ${fullDbName}\n-- Export Date: ${new Date().toISOString()}\n-- Server Version: 11.8.6-MariaDB\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`;

    const [tables]: any = await conn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const tableNames = tables.map((t: any) => Object.values(t)[0] as string);

    for (const table of tableNames) {
      const [createRes]: any = await conn.query(`SHOW CREATE TABLE \`${table}\``);
      const createSql = createRes[0]['Create Table'];

      sqlDump += `--\n-- Table structure for table \`${table}\`\n--\n\n`;
      sqlDump += `DROP TABLE IF EXISTS \`${table}\`;\n`;
      sqlDump += `${createSql};\n\n`;

      // Fetch rows
      const [rows]: any = await conn.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        sqlDump += `--\n-- Dumping data for table \`${table}\`\n--\n\n`;
        sqlDump += `LOCK TABLES \`${table}\` WRITE;\n`;

        for (const row of rows) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return v;
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
            return mysql.escape(String(v));
          }).join(', ');

          sqlDump += `INSERT INTO \`${table}\` (${keys}) VALUES (${values});\n`;
        }
        sqlDump += `UNLOCK TABLES;\n\n`;
      }
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n-- Dump completed\n`;

    return sqlDump;
  } finally {
    conn.release();
  }
}

export async function importDatabase(accountPrefix: string, fullDbName: string, sqlContent: string) {
  assertDatabaseOwnership(accountPrefix, fullDbName);

  if (!sqlContent || sqlContent.trim().length === 0) {
    throw new Error('SQL content to import is empty.');
  }

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${fullDbName}\``);

    // Split SQL content by statement
    const statements = sqlContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//gm, '')
      .split(/;\s*[\r\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let executedCount = 0;
    for (const stmt of statements) {
      if (stmt.length > 0) {
        await conn.query(stmt);
        executedCount++;
      }
    }

    return {
      success: true,
      statementsExecuted: executedCount
    };
  } finally {
    conn.release();
  }
}

export async function backupDatabase(domain: string, accountPrefix: string, fullDbName: string) {
  assertDatabaseOwnership(accountPrefix, fullDbName);

  const dump = await exportDatabase(accountPrefix, fullDbName);

  const backupDir = path.join(STORAGE_ROOT, 'domains', domain, 'backups', 'databases');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${fullDbName}_${timestamp}.sql`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, dump, 'utf-8');
  const stat = fs.statSync(filePath);

  return {
    success: true,
    filename,
    sizeBytes: stat.size,
    sizeFormatted: formatBytes(stat.size),
    createdAt: new Date().toISOString()
  };
}

export async function listBackups(domain: string, accountPrefix: string) {
  const backupDir = path.join(STORAGE_ROOT, 'domains', domain, 'backups', 'databases');
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
  const backups = [];

  for (const f of files) {
    const filePath = path.join(backupDir, f);
    const stat = fs.statSync(filePath);
    const parts = f.split('_');
    const dbName = parts.length >= 2 ? `${parts[0]}_${parts[1]}` : f;

    backups.push({
      filename: f,
      database: dbName,
      sizeBytes: stat.size,
      sizeFormatted: formatBytes(stat.size),
      createdAt: stat.mtime.toISOString()
    });
  }

  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
}

export async function restoreDatabase(domain: string, accountPrefix: string, fullDbName: string, backupFilename: string) {
  assertDatabaseOwnership(accountPrefix, fullDbName);

  const backupDir = path.join(STORAGE_ROOT, 'domains', domain, 'backups', 'databases');
  const filePath = path.join(backupDir, path.basename(backupFilename));

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file "${backupFilename}" not found on disk.`);
  }

  const sqlContent = fs.readFileSync(filePath, 'utf-8');
  return await importDatabase(accountPrefix, fullDbName, sqlContent);
}

// =============================================================================
// ONE-CLICK DATABASE MANAGER (phpMyAdmin style)
// =============================================================================
export function createManagerSession(domain: string, accountPrefix: string, database: string) {
  assertDatabaseOwnership(accountPrefix, database);

  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: ManagerSession = {
    token,
    domain,
    accountPrefix,
    database,
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000 // 30 minutes validity
  };

  managerSessions.set(token, session);
  return {
    token,
    database,
    expiresAt: session.expiresAt
  };
}

export function verifyManagerSession(token: string): ManagerSession {
  if (!token) throw new Error('Authentication token required.');
  const session = managerSessions.get(token);
  if (!session) throw new Error('Invalid or expired database manager session token.');
  if (session.expiresAt < Date.now()) {
    managerSessions.delete(token);
    throw new Error('Database manager session token has expired.');
  }
  return session;
}

export async function getManagerTables(token: string) {
  const session = verifyManagerSession(token);
  const conn = await getConnection();

  try {
    await conn.query(`USE \`${session.database}\``);

    const [tableList]: any = await conn.query(
      `SELECT TABLE_NAME as name, 
              ENGINE as engine, 
              TABLE_ROWS as row_count, 
              (DATA_LENGTH + INDEX_LENGTH) as data_size,
              TABLE_COLLATION as collation,
              CREATE_TIME as created_at
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME ASC`,
      [session.database]
    );

    return {
      database: session.database,
      tables: tableList.map((t: any) => ({
        name: t.name,
        engine: t.engine || 'InnoDB',
        rowCount: parseInt(t.row_count || '0', 10),
        sizeBytes: parseInt(t.data_size || '0', 10),
        sizeFormatted: formatBytes(parseInt(t.data_size || '0', 10)),
        collation: t.collation || 'utf8mb4_unicode_ci',
        createdAt: t.created_at
      }))
    };
  } finally {
    conn.release();
  }
}

export async function getManagerTableData(token: string, table: string, page = 1, pageSize = 25, search = '') {
  const session = verifyManagerSession(token);
  if (!validateIdentifier(table)) throw new Error('Invalid table identifier.');

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);

    // Get columns structure
    const [columns]: any = await conn.query(`DESCRIBE \`${table}\``);

    // Get total rows count
    const [countRes]: any = await conn.query(`SELECT COUNT(*) as total FROM \`${table}\``);
    const totalRows = parseInt(countRes[0]?.total || '0', 10);

    const offset = Math.max(0, (page - 1) * pageSize);
    let query = `SELECT * FROM \`${table}\``;
    const queryParams: any[] = [];

    if (search && search.trim()) {
      const searchCols = columns.map((c: any) => `\`${c.Field}\` LIKE ?`).join(' OR ');
      query += ` WHERE ${searchCols}`;
      columns.forEach(() => queryParams.push(`%${search.trim()}%`));
    }

    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(pageSize, offset);

    const [rows]: any = await conn.query(query, queryParams);

    return {
      table,
      columns: columns.map((c: any) => ({
        field: c.Field,
        type: c.Type,
        null: c.Null === 'YES',
        key: c.Key,
        default: c.Default,
        extra: c.Extra
      })),
      rows,
      page,
      pageSize,
      totalRows,
      totalPages: Math.ceil(totalRows / pageSize) || 1
    };
  } finally {
    conn.release();
  }
}

export async function executeManagerQuery(token: string, sql: string) {
  const session = verifyManagerSession(token);

  const cleanSql = sql.trim();
  if (!cleanSql) throw new Error('SQL query cannot be empty.');

  // Guard against server-wide or destructive cross-database operations
  const lower = cleanSql.toLowerCase();
  const forbiddenPatterns = [
    /\bshutdown\b/i,
    /\bdrop\s+database\b/i,
    /\bcreate\s+database\b/i,
    /\bgrant\s+.*\bon\s+\*\.\*/i,
    /\buse\s+(mysql|information_schema|performance_schema|sys)\b/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(lower)) {
      throw new Error('Security Error: Administrative server-wide queries are prohibited in user database console.');
    }
  }

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);

    const startTime = process.hrtime();
    const [result, fields]: any = await conn.query(cleanSql);
    const diff = process.hrtime(startTime);
    const durationMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

    if (Array.isArray(result)) {
      const colNames = fields ? fields.map((f: any) => f.name) : (result.length > 0 ? Object.keys(result[0]) : []);
      return {
        type: 'SELECT',
        columns: colNames,
        rows: result,
        rowCount: result.length,
        durationMs
      };
    } else {
      return {
        type: 'MUTATION',
        affectedRows: result.affectedRows || 0,
        insertId: result.insertId || 0,
        durationMs
      };
    }
  } finally {
    conn.release();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// CHECK AND REPAIR DATABASE (Video Reference Parity)
// ============================================================================

export async function checkDatabase(accountPrefix: string, database: string) {
  validateOwnership(database, accountPrefix);
  if (!validateIdentifier(database)) throw new Error('Invalid database name.');

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${database}\``);
    const [tables]: any = await conn.query(
      `SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [database]
    );

    if (!tables || tables.length === 0) {
      return {
        database,
        status: 'empty',
        message: 'Database contains no tables to check.',
        results: []
      };
    }

    const results: any[] = [];
    for (const t of tables) {
      const [checkRows]: any = await conn.query(`CHECK TABLE \`${t.name}\``);
      for (const row of checkRows) {
        results.push({
          table: t.name,
          op: row.Op || 'check',
          msgType: row.Msg_type || 'status',
          msgText: row.Msg_text || 'OK'
        });
      }
    }

    const hasErrors = results.some(r => r.msgType === 'error' || r.msgType === 'warning');
    return {
      database,
      status: hasErrors ? 'warning' : 'ok',
      message: hasErrors ? 'Issues found during database check.' : 'All tables in database passed integrity check with status OK.',
      results
    };
  } finally {
    conn.release();
  }
}

export async function repairDatabase(accountPrefix: string, database: string) {
  validateOwnership(database, accountPrefix);
  if (!validateIdentifier(database)) throw new Error('Invalid database name.');

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${database}\``);
    const [tables]: any = await conn.query(
      `SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [database]
    );

    if (!tables || tables.length === 0) {
      return {
        database,
        status: 'empty',
        message: 'Database contains no tables to repair.',
        results: []
      };
    }

    const results: any[] = [];
    for (const t of tables) {
      const [repairRows]: any = await conn.query(`REPAIR TABLE \`${t.name}\``);
      for (const row of repairRows) {
        results.push({
          table: t.name,
          op: row.Op || 'repair',
          msgType: row.Msg_type || 'status',
          msgText: row.Msg_text || 'OK'
        });
      }
    }

    return {
      database,
      status: 'ok',
      message: 'Repair table operation completed successfully.',
      results
    };
  } finally {
    conn.release();
  }
}

// ============================================================================
// RENAME DATABASE AND RENAME USER
// ============================================================================

export async function renameDatabaseUser(accountPrefix: string, oldUsername: string, newUsernameSuffix: string) {
  validateOwnership(oldUsername, accountPrefix);
  const cleanSuffix = newUsernameSuffix.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleanSuffix) throw new Error('New username suffix is required.');
  const fullNewUser = `${accountPrefix}_${cleanSuffix}`;

  if (fullNewUser.length > 32) throw new Error('Username exceeds maximum length of 32 characters.');
  if (!validateIdentifier(fullNewUser)) throw new Error('Invalid new username format.');

  const conn = await getConnection();
  try {
    // Check if new username already exists
    const [existing]: any = await conn.query(`SELECT User FROM mysql.user WHERE User = ?`, [fullNewUser]);
    if (existing.length > 0) {
      throw new Error(`Database user "${fullNewUser}" already exists.`);
    }

    await conn.query(`RENAME USER '${oldUsername}'@'%' TO '${fullNewUser}'@'%'`);
    await conn.query(`FLUSH PRIVILEGES`);

    return {
      success: true,
      oldUsername,
      newUsername: fullNewUser
    };
  } finally {
    conn.release();
  }
}

export async function renameDatabase(accountPrefix: string, oldDb: string, newDbSuffix: string) {
  validateOwnership(oldDb, accountPrefix);
  const cleanSuffix = newDbSuffix.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleanSuffix) throw new Error('New database name suffix is required.');
  const fullNewDb = `${accountPrefix}_${cleanSuffix}`;

  if (fullNewDb.length > 64) throw new Error('Database name exceeds maximum length of 64 characters.');
  if (!validateIdentifier(fullNewDb)) throw new Error('Invalid new database name format.');

  const conn = await getConnection();
  try {
    // Check if new database exists
    const [existing]: any = await conn.query(`SHOW DATABASES LIKE ?`, [fullNewDb]);
    if (existing.length > 0) {
      throw new Error(`Database "${fullNewDb}" already exists.`);
    }

    // Get old database collation
    const [dbInfo]: any = await conn.query(
      `SELECT DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation 
       FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [oldDb]
    );
    const charset = dbInfo[0]?.charset || 'utf8mb4';
    const collation = dbInfo[0]?.collation || 'utf8mb4_unicode_ci';

    // 1. Create new database
    await conn.query(`CREATE DATABASE \`${fullNewDb}\` CHARACTER SET ${charset} COLLATE ${collation}`);

    // 2. Move all tables from oldDb to fullNewDb
    const [tables]: any = await conn.query(
      `SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [oldDb]
    );
    for (const t of tables) {
      await conn.query(`RENAME TABLE \`${oldDb}\`.\`${t.name}\` TO \`${fullNewDb}\`.\`${t.name}\``);
    }

    // 3. Migrate privileges
    const [dbGrants]: any = await conn.query(`SELECT * FROM mysql.db WHERE Db = ?`, [oldDb]);
    for (const g of dbGrants) {
      await conn.query(
        `INSERT INTO mysql.db (Host, Db, User, Select_priv, Insert_priv, Update_priv, Delete_priv, Create_priv, Drop_priv, Grant_priv, References_priv, Index_priv, Alter_priv, Create_tmp_table_priv, Lock_tables_priv, Create_view_priv, Show_view_priv, Create_routine_priv, Alter_routine_priv, Execute_priv, Event_priv, Trigger_priv)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE Select_priv=VALUES(Select_priv)`,
        [
          g.Host, fullNewDb, g.User,
          g.Select_priv, g.Insert_priv, g.Update_priv, g.Delete_priv,
          g.Create_priv, g.Drop_priv, g.Grant_priv, g.References_priv,
          g.Index_priv, g.Alter_priv, g.Create_tmp_table_priv, g.Lock_tables_priv,
          g.Create_view_priv, g.Show_view_priv, g.Create_routine_priv, g.Alter_routine_priv,
          g.Execute_priv, g.Event_priv, g.Trigger_priv
        ]
      );
    }

    // 4. Drop old database
    await conn.query(`DROP DATABASE \`${oldDb}\``);
    await conn.query(`FLUSH PRIVILEGES`);

    return {
      success: true,
      oldDatabase: oldDb,
      newDatabase: fullNewDb,
      tablesMoved: tables.length
    };
  } finally {
    conn.release();
  }
}

// ============================================================================
// DATABASE MANAGER TABLE & DATA OPERATIONS
// ============================================================================

export async function getTenantDatabasesForManager(token: string) {
  const session = verifyManagerSession(token);
  return listDatabases(session.accountPrefix);
}

export async function switchManagerDatabase(token: string, newDatabase: string) {
  const session = verifyManagerSession(token);
  validateOwnership(newDatabase, session.accountPrefix);
  session.database = newDatabase;
  return { success: true, database: newDatabase };
}

export async function createTable(
  token: string,
  tableName: string,
  columns: Array<{
    name: string;
    type: string;
    length?: string | number;
    nullable?: boolean;
    defaultValue?: string;
    autoIncrement?: boolean;
    primaryKey?: boolean;
  }>,
  engine: string = 'InnoDB'
) {
  const session = verifyManagerSession(token);
  if (!validateIdentifier(tableName)) throw new Error('Invalid table name.');
  if (!columns || columns.length === 0) throw new Error('At least one column is required.');

  const colDefs: string[] = [];
  const primaryKeys: string[] = [];

  for (const col of columns) {
    if (!validateIdentifier(col.name)) throw new Error(`Invalid column name: ${col.name}`);
    const typeUpper = col.type.toUpperCase();
    let def = `\`${col.name}\` ${typeUpper}`;
    if (col.length && ['VARCHAR', 'CHAR', 'DECIMAL', 'INT'].some(t => typeUpper.startsWith(t))) {
      def += `(${col.length})`;
    }
    if (!col.nullable) def += ' NOT NULL';
    else def += ' NULL';

    if (col.defaultValue !== undefined && col.defaultValue !== null && col.defaultValue !== '') {
      def += ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`;
    }
    if (col.autoIncrement) def += ' AUTO_INCREMENT';
    if (col.primaryKey) primaryKeys.push(`\`${col.name}\``);

    colDefs.push(def);
  }

  if (primaryKeys.length > 0) {
    colDefs.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
  }

  const validEngines = ['InnoDB', 'MyISAM', 'MEMORY'];
  const safeEngine = validEngines.includes(engine) ? engine : 'InnoDB';
  const sql = `CREATE TABLE \`${tableName}\` (\n  ${colDefs.join(',\n  ')}\n) ENGINE=${safeEngine} DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);
    await conn.query(sql);
    return { success: true, table: tableName, sql };
  } finally {
    conn.release();
  }
}

export async function dropTable(token: string, tableName: string) {
  const session = verifyManagerSession(token);
  if (!validateIdentifier(tableName)) throw new Error('Invalid table name.');

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);
    await conn.query(`DROP TABLE \`${tableName}\``);
    return { success: true, table: tableName };
  } finally {
    conn.release();
  }
}

export async function truncateTable(token: string, tableName: string) {
  const session = verifyManagerSession(token);
  if (!validateIdentifier(tableName)) throw new Error('Invalid table name.');

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);
    await conn.query(`TRUNCATE TABLE \`${tableName}\``);
    return { success: true, table: tableName };
  } finally {
    conn.release();
  }
}

export async function insertTableRow(token: string, tableName: string, rowData: Record<string, any>) {
  const session = verifyManagerSession(token);
  if (!validateIdentifier(tableName)) throw new Error('Invalid table name.');

  const keys = Object.keys(rowData).filter(k => validateIdentifier(k));
  if (keys.length === 0) throw new Error('No valid column data provided.');

  const fields = keys.map(k => `\`${k}\``).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => rowData[k]);

  const sql = `INSERT INTO \`${tableName}\` (${fields}) VALUES (${placeholders})`;

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);
    const [result]: any = await conn.query(sql, values);
    return { success: true, insertId: result.insertId, affectedRows: result.affectedRows };
  } finally {
    conn.release();
  }
}

export async function updateTableRow(
  token: string,
  tableName: string,
  primaryKeyCol: string,
  primaryKeyValue: any,
  rowData: Record<string, any>
) {
  const session = verifyManagerSession(token);
  if (!validateIdentifier(tableName)) throw new Error('Invalid table name.');
  if (!validateIdentifier(primaryKeyCol)) throw new Error('Invalid primary key column.');

  const keys = Object.keys(rowData).filter(k => validateIdentifier(k) && k !== primaryKeyCol);
  if (keys.length === 0) throw new Error('No data to update.');

  const setClauses = keys.map(k => `\`${k}\` = ?`).join(', ');
  const values = keys.map(k => rowData[k]);
  values.push(primaryKeyValue);

  const sql = `UPDATE \`${tableName}\` SET ${setClauses} WHERE \`${primaryKeyCol}\` = ?`;

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);
    const [result]: any = await conn.query(sql, values);
    return { success: true, affectedRows: result.affectedRows };
  } finally {
    conn.release();
  }
}

export async function deleteTableRow(token: string, tableName: string, primaryKeyCol: string, primaryKeyValue: any) {
  const session = verifyManagerSession(token);
  if (!validateIdentifier(tableName)) throw new Error('Invalid table name.');
  if (!validateIdentifier(primaryKeyCol)) throw new Error('Invalid primary key column.');

  const sql = `DELETE FROM \`${tableName}\` WHERE \`${primaryKeyCol}\` = ? LIMIT 1`;

  const conn = await getConnection();
  try {
    await conn.query(`USE \`${session.database}\``);
    const [result]: any = await conn.query(sql, [primaryKeyValue]);
    return { success: true, affectedRows: result.affectedRows };
  } finally {
    conn.release();
  }
}

/**
 * Creates a real Single Sign-On (SSO) ticket for phpMyAdmin.
 * Authenticates the tenant with isolated database access and generates
 * a single-use cryptographically random token for instantaneous access.
 */
export async function createPhpMyAdminSSOToken(domain: string, accountPrefix: string, database?: string, clientHost?: string) {
  if (database) {
    assertDatabaseOwnership(accountPrefix, database);
  }

  const pool = await getPool();
  const accountUser = accountPrefix;
  // Deterministic secure internal secret for this account's phpMyAdmin access
  const secretSeed = `sitechai_pma_sso_${accountPrefix}_2026_secured`;
  const accountPassword = crypto.createHash('sha256').update(secretSeed).digest('hex').slice(0, 24) + '!Aa1';

  // Ensure account database user exists with permissions strictly on this account's databases
  try {
    await pool.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [accountUser, accountPassword]);
    await pool.query(`CREATE USER IF NOT EXISTS ?@'127.0.0.1' IDENTIFIED BY ?`, [accountUser, accountPassword]);
    await pool.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [accountUser, accountPassword]);
    await pool.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [accountUser, accountPassword]);
    await pool.query(`ALTER USER ?@'127.0.0.1' IDENTIFIED BY ?`, [accountUser, accountPassword]);
    await pool.query(`ALTER USER ?@'%' IDENTIFIED BY ?`, [accountUser, accountPassword]);
    await pool.query(`GRANT ALL PRIVILEGES ON \`${accountPrefix}\\_%\`.* TO ?@'localhost'`, [accountUser]);
    await pool.query(`GRANT ALL PRIVILEGES ON \`${accountPrefix}\\_%\`.* TO ?@'127.0.0.1'`, [accountUser]);
    await pool.query(`GRANT ALL PRIVILEGES ON \`${accountPrefix}\\_%\`.* TO ?@'%'`, [accountUser]);
    await pool.query('FLUSH PRIVILEGES');
  } catch (err: any) {
    console.error('[PMA SSO USER SETUP ERROR]:', err);
  }

  // Generate single-use random ticket
  const token = crypto.randomBytes(32).toString('hex');
  const ticket = {
    user: accountUser,
    password: accountPassword,
    database: database || '',
    domain,
    accountPrefix,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000 // 60s single-use TTL
  };

  const ticketJson = JSON.stringify(ticket);
  let written = false;

  // Fast write via WSL pipe
  try {
    if (process.platform === 'win32') {
      execSync(`wsl -d Ubuntu -u root bash -c "cat > /tmp/pma_sso_${token}.json; chmod 644 /tmp/pma_sso_${token}.json"`, {
        input: ticketJson,
        timeout: 5000
      });
      written = true;
    } else {
      fs.writeFileSync(`/tmp/pma_sso_${token}.json`, ticketJson, 'utf-8');
      fs.chmodSync(`/tmp/pma_sso_${token}.json`, 0o644);
      written = true;
    }
  } catch (e) {
    console.error('[PMA SSO TICKET WRITE ERROR]:', e);
  }

  const host = clientHost || 'localhost';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
  const ssoUrl = isLocal
    ? `http://${host}:8080/sso.php?token=${token}${database ? '&db=' + encodeURIComponent(database) : ''}`
    : `/phpmyadmin/sso.php?token=${token}${database ? '&db=' + encodeURIComponent(database) : ''}`;

  return {
    success: true,
    token,
    ssoUrl,
    database: database || null,
    accountUser
  };
}

export function getResolvedHost(): string {
  if (process.platform === 'win32') {
    try {
      const wslOut = execSync('wsl -d Ubuntu -e hostname -I', { encoding: 'utf-8', timeout: 3000 });
      const wslIp = wslOut.trim().split(/\s+/)[0];
      if (wslIp && /^\d+\.\d+\.\d+\.\d+$/.test(wslIp)) {
        return wslIp;
      }
    } catch (e) {}
  }
  return 'localhost';
}

