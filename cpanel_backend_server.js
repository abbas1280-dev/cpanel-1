/**
 * cPanel Jupiter Control Panel - Production VPS Backend Server
 * 
 * Multi-Tenant Architecture for Linux VPS (Ubuntu / AlmaLinux / Debian)
 * Integrates:
 *  - Real MariaDB 10.11+ / 11.x via mysql2/promise connection pool
 *  - Real Linux Filesystem (/home/{user}/) via Node.js fs/promises
 *  - Real phpMyAdmin Signon / SSO Bridge
 *  - Hardened multi-tenant isolation & SQL injection prevention
 */

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION & ENVIRONMENT
// ==========================================
const CONFIG = {
  systemUser: process.env.CPANEL_USER || 'turkyhu1',
  userHome: process.env.CPANEL_HOME || '/home/turkyhu1',
  dbHost: process.env.MARIADB_HOST || '127.0.0.1',
  dbPort: parseInt(process.env.MARIADB_PORT || '3306', 10),
  dbAdminUser: process.env.MARIADB_ADMIN_USER || 'root',
  dbAdminPassword: process.env.MARIADB_ADMIN_PASSWORD || '',
  pmaUrl: process.env.PMA_URL || '/phpmyadmin',
  ssoSecret: process.env.SSO_SECRET || crypto.randomBytes(32).toString('hex'),
  tokenExpiryMs: 60 * 1000 // SSO tokens expire in 60s
};

// Ensure user directory structure exists
const TRASH_DIR = path.join(CONFIG.userHome, '.trash');
if (!fs.existsSync(CONFIG.userHome)) {
  try {
    fs.mkdirSync(CONFIG.userHome, { recursive: true, mode: 0o755 });
    fs.mkdirSync(path.join(CONFIG.userHome, 'public_html'), { recursive: true, mode: 0o755 });
    fs.mkdirSync(TRASH_DIR, { recursive: true, mode: 0o700 });
  } catch (err) {
    console.warn('[Storage] Warning initializing home dirs:', err.message);
  }
}

// In-memory SSO token store
const ssoTokens = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// MARIADB CONNECTION POOL
// ==========================================
let pool = null;

async function getDbPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: CONFIG.dbHost,
    port: CONFIG.dbPort,
    user: CONFIG.dbAdminUser,
    password: CONFIG.dbAdminPassword,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });
  return pool;
}

// Validate database/username prefix isolation
function sanitizeIdentifier(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function enforceDbName(rawName) {
  const clean = sanitizeIdentifier(rawName);
  const prefix = `${CONFIG.systemUser}_`;
  return clean.startsWith(prefix) ? clean : `${prefix}${clean}`;
}

function enforceUserName(rawName) {
  const clean = sanitizeIdentifier(rawName);
  const prefix = `${CONFIG.systemUser}_`;
  const name = clean.startsWith(prefix) ? clean : `${prefix}${clean}`;
  return name.slice(0, 32);
}

// ==========================================
// 1. DATABASE API ROUTES
// ==========================================

// GET /api/databases/list - List all user databases and disk usage
app.get('/api/databases/list', async (req, res) => {
  try {
    const db = await getDbPool();
    const prefix = `${CONFIG.systemUser}_%`;

    // 1. Fetch databases belonging to user
    const [dbRows] = await db.query(
      `SELECT SCHEMA_NAME as db_name, DEFAULT_COLLATION_NAME as collation_name
       FROM information_schema.SCHEMATA 
       WHERE SCHEMA_NAME LIKE ? OR SCHEMA_NAME = ?
       ORDER BY SCHEMA_NAME ASC`,
      [prefix, CONFIG.systemUser]
    );

    // 2. Fetch size for each database
    const [sizeRows] = await db.query(
      `SELECT table_schema AS db_name, 
              COALESCE(SUM(data_length + index_length), 0) AS size_bytes
       FROM information_schema.TABLES
       WHERE table_schema LIKE ? OR table_schema = ?
       GROUP BY table_schema`,
      [prefix, CONFIG.systemUser]
    );
    const sizeMap = new Map();
    sizeRows.forEach(r => sizeMap.set(r.db_name, Number(r.size_bytes)));

    // 3. Fetch user privilege grants per database
    const [privRows] = await db.query(
      `SELECT Db as db_name, User as user_name
       FROM mysql.db
       WHERE (Db LIKE ? OR Db = ?) AND (User LIKE ? OR User = ?)`,
      [prefix, CONFIG.systemUser, prefix, CONFIG.systemUser]
    );
    const usersMap = new Map();
    privRows.forEach(r => {
      if (!usersMap.has(r.db_name)) usersMap.set(r.db_name, []);
      if (!usersMap.get(r.db_name).includes(r.user_name)) {
        usersMap.get(r.db_name).push(r.user_name);
      }
    });

    const databases = dbRows.map(r => {
      const sizeBytes = sizeMap.get(r.db_name) || 0;
      let sizeFormatted = '0.00 B';
      if (sizeBytes >= 1024 * 1024) {
        sizeFormatted = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
      } else if (sizeBytes >= 1024) {
        sizeFormatted = `${(sizeBytes / 1024).toFixed(2)} KB`;
      } else if (sizeBytes > 0) {
        sizeFormatted = `${sizeBytes} B`;
      }

      return {
        name: r.db_name,
        sizeBytes,
        sizeFormatted,
        collation: r.collation_name,
        users: usersMap.get(r.db_name) || []
      };
    });

    // 4. Fetch all user accounts belonging to this cPanel prefix
    const [userRows] = await db.query(
      `SELECT User as user_name, Host as host
       FROM mysql.user
       WHERE User LIKE ? OR User = ?
       ORDER BY User ASC`,
      [prefix, CONFIG.systemUser]
    );

    res.json({
      success: true,
      databases,
      users: userRows.map(u => u.user_name),
      prefix: `${CONFIG.systemUser}_`
    });
  } catch (err) {
    console.error('[API] /api/databases/list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/create - Create new database
app.post('/api/databases/create', async (req, res) => {
  try {
    const { dbName } = req.body;
    if (!dbName) return res.status(400).json({ success: false, error: 'Database name is required' });

    const fullDbName = enforceDbName(dbName);
    const db = await getDbPool();

    await db.query(`CREATE DATABASE \`${fullDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    res.json({
      success: true,
      database: fullDbName,
      message: `Database \`${fullDbName}\` created successfully.`
    });
  } catch (err) {
    console.error('[API] /api/databases/create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/delete - Drop database
app.post('/api/databases/delete', async (req, res) => {
  try {
    const { dbName } = req.body;
    if (!dbName) return res.status(400).json({ success: false, error: 'Database name is required' });

    const fullDbName = enforceDbName(dbName);
    const db = await getDbPool();

    await db.query(`DROP DATABASE \`${fullDbName}\``);

    res.json({
      success: true,
      message: `Database \`${fullDbName}\` permanently deleted.`
    });
  } catch (err) {
    console.error('[API] /api/databases/delete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/rename - Safe rename (Table move)
app.post('/api/databases/rename', async (req, res) => {
  try {
    const { oldDbName, newDbName } = req.body;
    if (!oldDbName || !newDbName) {
      return res.status(400).json({ success: false, error: 'Both old and new names required' });
    }

    const srcDb = enforceDbName(oldDbName);
    const dstDb = enforceDbName(newDbName);

    if (srcDb === dstDb) {
      return res.status(400).json({ success: false, error: 'Names must be different' });
    }

    const db = await getDbPool();
    await db.query(`CREATE DATABASE \`${dstDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    const [tables] = await db.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [srcDb]
    );

    for (const t of tables) {
      const tbl = t.TABLE_NAME;
      await db.query(`RENAME TABLE \`${srcDb}\`.\`${tbl}\` TO \`${dstDb}\`.\`${tbl}\``);
    }

    await db.query(`UPDATE mysql.db SET Db = ? WHERE Db = ?`, [dstDb, srcDb]);
    await db.query(`FLUSH PRIVILEGES`);
    await db.query(`DROP DATABASE \`${srcDb}\``);

    res.json({
      success: true,
      message: `Database renamed from \`${srcDb}\` to \`${dstDb}\`.`
    });
  } catch (err) {
    console.error('[API] /api/databases/rename error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/check - Check all tables in DB
app.post('/api/databases/check', async (req, res) => {
  try {
    const { dbName } = req.body;
    if (!dbName) return res.status(400).json({ success: false, error: 'Database name required' });

    const fullDbName = enforceDbName(dbName);
    const db = await getDbPool();

    const [tables] = await db.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [fullDbName]
    );

    if (tables.length === 0) {
      return res.json({
        success: true,
        database: fullDbName,
        status: 'OK',
        results: [{ Table: `${fullDbName}.(empty)`, Op: 'check', Msg_type: 'status', Msg_text: 'OK (No tables in database)' }]
      });
    }

    const results = [];
    for (const t of tables) {
      const [resRows] = await db.query(`CHECK TABLE \`${fullDbName}\`.\`${t.TABLE_NAME}\``);
      results.push(...resRows);
    }

    res.json({ success: true, database: fullDbName, results });
  } catch (err) {
    console.error('[API] /api/databases/check error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/repair - Repair all tables in DB
app.post('/api/databases/repair', async (req, res) => {
  try {
    const { dbName } = req.body;
    if (!dbName) return res.status(400).json({ success: false, error: 'Database name required' });

    const fullDbName = enforceDbName(dbName);
    const db = await getDbPool();

    const [tables] = await db.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [fullDbName]
    );

    if (tables.length === 0) {
      return res.json({
        success: true,
        database: fullDbName,
        status: 'OK',
        results: [{ Table: `${fullDbName}.(empty)`, Op: 'repair', Msg_type: 'status', Msg_text: 'OK (No tables in database)' }]
      });
    }

    const results = [];
    for (const t of tables) {
      const [resRows] = await db.query(`REPAIR TABLE \`${fullDbName}\`.\`${t.TABLE_NAME}\``);
      results.push(...resRows);
    }

    res.json({ success: true, database: fullDbName, results });
  } catch (err) {
    console.error('[API] /api/databases/repair error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/users/create - Create MariaDB user
app.post('/api/databases/users/create', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const fullUser = enforceUserName(username);
    const db = await getDbPool();

    await db.query(`CREATE USER ?@'localhost' IDENTIFIED BY ?`, [fullUser, password]);
    await db.query(`FLUSH PRIVILEGES`);

    res.json({
      success: true,
      username: fullUser,
      message: `User \`${fullUser}\` created successfully.`
    });
  } catch (err) {
    console.error('[API] /api/databases/users/create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/users/delete - Drop MariaDB user
app.post('/api/databases/users/delete', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, error: 'Username required' });

    const fullUser = enforceUserName(username);
    const db = await getDbPool();

    await db.query(`DROP USER ?@'localhost'`, [fullUser]);
    await db.query(`FLUSH PRIVILEGES`);

    res.json({
      success: true,
      message: `User \`${fullUser}\` deleted successfully.`
    });
  } catch (err) {
    console.error('[API] /api/databases/users/delete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/users/password - Update password
app.post('/api/databases/users/password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ success: false, error: 'Username and new password required' });
    }

    const fullUser = enforceUserName(username);
    const db = await getDbPool();

    await db.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [fullUser, newPassword]);
    await db.query(`FLUSH PRIVILEGES`);

    res.json({
      success: true,
      message: `Password for \`${fullUser}\` updated successfully.`
    });
  } catch (err) {
    console.error('[API] /api/databases/users/password error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/databases/privileges - Grant privileges
app.post('/api/databases/privileges', async (req, res) => {
  try {
    const { dbName, username, privileges } = req.body;
    if (!dbName || !username) {
      return res.status(400).json({ success: false, error: 'Database and user required' });
    }

    const fullDb = enforceDbName(dbName);
    const fullUser = enforceUserName(username);
    const db = await getDbPool();

    try {
      await db.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@'localhost'`, [fullUser]);
    } catch (e) {}

    const allowed = [
      'ALL PRIVILEGES', 'ALTER', 'ALTER ROUTINE', 'CREATE', 'CREATE ROUTINE',
      'CREATE TEMPORARY TABLES', 'CREATE VIEW', 'DELETE', 'DROP', 'EVENT',
      'EXECUTE', 'INDEX', 'INSERT', 'LOCK TABLES', 'REFERENCES', 'SELECT',
      'SHOW VIEW', 'TRIGGER', 'UPDATE'
    ];

    let privList = 'ALL PRIVILEGES';
    if (Array.isArray(privileges) && privileges.length > 0) {
      const sanitized = privileges.filter(p => allowed.includes(p.toUpperCase()));
      if (sanitized.length > 0) {
        privList = sanitized.join(', ');
      }
    }

    await db.query(`GRANT ${privList} ON \`${fullDb}\`.* TO ?@'localhost'`, [fullUser]);
    await db.query(`FLUSH PRIVILEGES`);

    res.json({
      success: true,
      message: `Privileges [${privList}] successfully granted to ${fullUser} on ${fullDb}.`
    });
  } catch (err) {
    console.error('[API] /api/databases/privileges error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. PHPMYADMIN SSO BRIDGE
// ==========================================

app.post('/api/pma-sso', async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenDir = '/tmp/cpanel_pma_sso';
    if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { mode: 0o700, recursive: true });
    
    fs.writeFileSync(
      path.join(tokenDir, `${token}.json`),
      JSON.stringify({
        user: CONFIG.systemUser,
        dbUser: CONFIG.dbAdminUser,
        dbPass: CONFIG.dbAdminPassword,
        expiresAt: Date.now() + CONFIG.tokenExpiryMs
      }),
      { mode: 0o600 }
    );

    const redirectUrl = `${CONFIG.pmaUrl}/signon.php?token=${token}`;

    res.json({
      success: true,
      token,
      redirectUrl
    });
  } catch (err) {
    console.error('[API] /api/pma-sso error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. FILE MANAGER POSIX APIS
// ==========================================

function resolveSafePath(userRelativePath) {
  const sanitized = path.normalize(userRelativePath || '').replace(/^(\.\.[\/\\])+/, '');
  const absolute = path.resolve(CONFIG.userHome, sanitized.startsWith('/') ? sanitized.slice(1) : sanitized);
  if (!absolute.startsWith(CONFIG.userHome)) {
    throw new Error('Access denied: Path traverses outside user home directory');
  }
  return absolute;
}

app.get('/api/files/list', async (req, res) => {
  try {
    const dirParam = req.query.dir || '';
    const targetDir = resolveSafePath(dirParam);

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: 'Directory not found' });
    }

    const dirents = await fsp.readdir(targetDir, { withFileTypes: true });
    const items = await Promise.all(
      dirents.map(async (d) => {
        try {
          const itemPath = path.join(targetDir, d.name);
          const stat = await fsp.stat(itemPath);
          const isDir = d.isDirectory();
          const permOctal = '0' + (stat.mode & 0o777).toString(8);

          let sizeStr = '0 B';
          if (isDir) {
            sizeStr = '4 KB';
          } else if (stat.size >= 1024 * 1024) {
            sizeStr = `${(stat.size / (1024 * 1024)).toFixed(2)} MB`;
          } else if (stat.size >= 1024) {
            sizeStr = `${(stat.size / 1024).toFixed(1)} KB`;
          } else {
            sizeStr = `${stat.size} bytes`;
          }

          const dateStr = new Date(stat.mtime).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          let mime = isDir ? 'httpd/unix-directory' : 'text/plain';
          const ext = path.extname(d.name).toLowerCase();
          if (ext === '.html' || ext === '.htm') mime = 'text/html';
          else if (ext === '.css') mime = 'text/css';
          else if (ext === '.js') mime = 'application/javascript';
          else if (ext === '.json') mime = 'application/json';
          else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') mime = 'image/' + ext.replace('.', '');
          else if (ext === '.php') mime = 'application/x-php';

          return {
            name: d.name,
            size: sizeStr,
            sizeBytes: stat.size,
            date: dateStr,
            type: mime,
            perm: permOctal,
            isFolder: isDir
          };
        } catch (e) {
          return null;
        }
      })
    );

    const filtered = items.filter(Boolean);
    filtered.sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });

    res.json({
      success: true,
      currentPath: path.relative(CONFIG.userHome, targetDir).replace(/\\/g, '/') || '/',
      files: filtered
    });
  } catch (err) {
    console.error('[API] /api/files/list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/files/create', async (req, res) => {
  try {
    const { dir, name, isFolder } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const parentDir = resolveSafePath(dir || '');
    const targetPath = path.join(parentDir, name);

    if (fs.existsSync(targetPath)) {
      return res.status(400).json({ success: false, error: 'Item already exists' });
    }

    if (isFolder) {
      await fsp.mkdir(targetPath, { recursive: true, mode: 0o755 });
    } else {
      await fsp.writeFile(targetPath, '', { mode: 0o644, encoding: 'utf-8' });
    }

    res.json({
      success: true,
      message: `${isFolder ? 'Folder' : 'File'} "${name}" created successfully.`
    });
  } catch (err) {
    console.error('[API] /api/files/create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/files/rename', async (req, res) => {
  try {
    const { dir, oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: 'Old and new names required' });
    }

    const parentDir = resolveSafePath(dir || '');
    const oldPath = path.join(parentDir, oldName);
    const newPath = path.join(parentDir, newName);

    if (!fs.existsSync(oldPath)) return res.status(404).json({ success: false, error: 'File does not exist' });
    if (fs.existsSync(newPath)) return res.status(400).json({ success: false, error: 'Destination exists' });

    await fsp.rename(oldPath, newPath);

    res.json({ success: true, message: `Renamed "${oldName}" to "${newName}"` });
  } catch (err) {
    console.error('[API] /api/files/rename error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/files/delete', async (req, res) => {
  try {
    const { dir, name, skipTrash } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const parentDir = resolveSafePath(dir || '');
    const targetPath = path.join(parentDir, name);

    if (!fs.existsSync(targetPath)) return res.status(404).json({ success: false, error: 'File not found' });

    if (skipTrash) {
      await fsp.rm(targetPath, { recursive: true, force: true });
    } else {
      const trashDest = path.join(TRASH_DIR, `${Date.now()}_${name}`);
      await fsp.rename(targetPath, trashDest);
    }

    res.json({ success: true, message: `"${name}" removed successfully.` });
  } catch (err) {
    console.error('[API] /api/files/delete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/files/read', async (req, res) => {
  try {
    const filePath = resolveSafePath(req.query.path || '');
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'File not found' });

    const content = await fsp.readFile(filePath, 'utf-8');
    res.json({ success: true, content });
  } catch (err) {
    console.error('[API] /api/files/read error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/files/write', async (req, res) => {
  try {
    const { path: relPath, content } = req.body;
    const filePath = resolveSafePath(relPath || '');

    await fsp.writeFile(filePath, content || '', 'utf-8');
    res.json({ success: true, message: 'File saved successfully.' });
  } catch (err) {
    console.error('[API] /api/files/write error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`cPanel Backend running on http://0.0.0.0:${PORT}`);
});
