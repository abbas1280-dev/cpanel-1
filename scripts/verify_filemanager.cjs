const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const DOMAIN = 'turkyhub.com';
const STORAGE_ROOT = path.resolve(process.cwd(), 'server_storage');
const DOMAIN_ROOT = path.join(STORAGE_ROOT, 'domains', DOMAIN);

function request(options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });
    req.on('error', reject);
    if (bodyData) {
      if (typeof bodyData === 'string' || Buffer.isBuffer(bodyData)) {
        req.write(bodyData);
      } else {
        req.write(JSON.stringify(bodyData));
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('FILE MANAGER FULL FUNCTIONALITY AUDIT & E2E TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  [PASS] ' + message);
      passed++;
    } else {
      console.error('  [FAIL] ' + message);
      failed++;
    }
  }

  try {
    // 1. Directory Listing & Cache Headers
    console.log('1. Testing Directory Listing (/api/filemanager/list)...');
    const listRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/list?domain=' + DOMAIN + '&path=/public_html&_t=' + Date.now(),
      method: 'GET'
    });
    assert(listRes.statusCode === 200, 'Status code 200 OK (got ' + listRes.statusCode + ')');
    assert(listRes.headers['cache-control'] && listRes.headers['cache-control'].includes('no-store'), 'Cache-Control: no-store header present');
    assert(Array.isArray(listRes.data.items), 'Returns array of items');

    // 2. Folder Tree Hierarchy
    console.log('\n2. Testing Folder Tree Hierarchy (/api/filemanager/tree)...');
    const treeRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/tree?domain=' + DOMAIN + '&_t=' + Date.now(),
      method: 'GET'
    });
    assert(treeRes.statusCode === 200, 'Tree status code 200 OK (got ' + treeRes.statusCode + ')');
    assert(treeRes.data.name && treeRes.data.children, 'Tree structure valid');

    // 3. Create Folder
    console.log('\n3. Testing Create Folder (/api/filemanager/create-folder)...');
    const createFolderRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/create-folder',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html',
      folderName: 'test_audit_dir'
    });
    assert(createFolderRes.statusCode === 200 && createFolderRes.data.success, 'Create folder API succeeded');
    const diskFolder = path.join(DOMAIN_ROOT, 'public_html', 'test_audit_dir');
    assert(fs.existsSync(diskFolder) && fs.statSync(diskFolder).isDirectory(), 'Folder created on physical disk');

    // 4. Create File
    console.log('\n4. Testing Create File (/api/filemanager/create-file)...');
    const createFileRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/create-file',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html/test_audit_dir',
      filename: 'app.php',
      content: '<?php echo "Hello Sitechai Audit"; ?>'
    });
    assert(createFileRes.statusCode === 200 && createFileRes.data.success, 'Create file API succeeded');
    const diskFile = path.join(diskFolder, 'app.php');
    assert(fs.existsSync(diskFile), 'File created on physical disk');

    // 5. Read File
    console.log('\n5. Testing Read File (/api/filemanager/read-file)...');
    const readRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/read-file',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html/test_audit_dir',
      filename: 'app.php'
    });
    assert(readRes.statusCode === 200 && readRes.data.content && readRes.data.content.includes('Hello Sitechai Audit'), 'File content read accurately');

    // 6. Save File Content (Edit)
    console.log('\n6. Testing Save File Content (/api/filemanager/save-file)...');
    const saveRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/save-file',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html/test_audit_dir',
      filename: 'app.php',
      content: '<?php echo "Updated Version 2.0"; ?>'
    });
    assert(saveRes.statusCode === 200 && saveRes.data.success, 'Save file API succeeded');
    assert(fs.readFileSync(diskFile, 'utf-8').includes('Updated Version 2.0'), 'Updated content persisted to physical disk');

    // 7. Permissions Change
    console.log('\n7. Testing Permissions Change (/api/filemanager/permissions)...');
    const permRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/permissions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html/test_audit_dir',
      filename: 'app.php',
      permissions: '0755'
    });
    assert(permRes.statusCode === 200 && permRes.data.success, 'Change permissions API succeeded');

    // 8. Rename File
    console.log('\n8. Testing Rename (/api/filemanager/rename)...');
    const renameRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/rename',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html/test_audit_dir',
      oldName: 'app.php',
      newName: 'index.php'
    });
    assert(renameRes.statusCode === 200 && renameRes.data.success, 'Rename API succeeded');
    assert(!fs.existsSync(diskFile) && fs.existsSync(path.join(diskFolder, 'index.php')), 'Physical disk file renamed to index.php');

    // 9. Copy File
    console.log('\n9. Testing Copy (/api/filemanager/copy)...');
    const copyRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/copy',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      sourcePath: '/public_html/test_audit_dir',
      items: ['index.php'],
      destinationPath: '/public_html/test_audit_dir'
    });
    assert(copyRes.statusCode === 200 && copyRes.data.success, 'Copy API succeeded');
    assert(fs.existsSync(path.join(diskFolder, 'index_copy.php')), 'Physical copy created on disk');

    // 10. Move File
    console.log('\n10. Testing Move (/api/filemanager/move)...');
    const moveRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/move',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      sourcePath: '/public_html/test_audit_dir',
      items: ['index_copy.php'],
      destinationPath: '/public_html'
    });
    assert(moveRes.statusCode === 200 && moveRes.data.success, 'Move API succeeded');
    assert(fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'index_copy.php')), 'Item moved to destination on disk');

    // 11. Compress / Archive
    console.log('\n11. Testing Compress / Archive (/api/filemanager/compress)...');
    const compressRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/compress',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html',
      items: ['test_audit_dir'],
      archiveName: 'test_audit.zip',
      format: 'zip'
    });
    assert(compressRes.statusCode === 200 && compressRes.data.success, 'Compress API succeeded');
    const zipPath = path.join(DOMAIN_ROOT, 'public_html', 'test_audit.zip');
    assert(fs.existsSync(zipPath), 'ZIP archive created on physical disk');

    // 12. Extract Archive
    console.log('\n12. Testing Extract Archive (/api/filemanager/extract)...');
    const extractRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/extract',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html',
      archiveName: 'test_audit.zip',
      destination: '/public_html/test_extracted'
    });
    assert(extractRes.statusCode === 200 && extractRes.data.success, 'Extract API succeeded');
    assert(fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'test_extracted')), 'Extracted directory exists on physical disk');

    // 13. Streaming Upload
    console.log('\n13. Testing Streaming File Upload (/api/filemanager/upload-stream)...');
    const sampleBuffer = Buffer.from('Stream upload test content 123456');
    const uploadRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/upload-stream?domain=' + DOMAIN + '&path=/public_html&filename=stream_test.txt',
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': sampleBuffer.length
      }
    }, sampleBuffer);
    assert(uploadRes.statusCode === 200 && uploadRes.data.success, 'Upload stream API succeeded');
    assert(fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'stream_test.txt')), 'Uploaded file exists on physical disk');

    // 14. Download File
    console.log('\n14. Testing Download File (/api/filemanager/download)...');
    const dlRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/download?domain=' + DOMAIN + '&path=/public_html&file=stream_test.txt',
      method: 'GET'
    });
    assert(dlRes.statusCode === 200 && dlRes.data.includes('Stream upload test content'), 'Downloaded content matches uploaded stream');

    // 15. Delete Single File (Move to .trash)
    console.log('\n15. Testing Single File Delete to .trash (/api/filemanager/delete)...');
    const delTrashRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/delete',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html',
      items: ['index_copy.php'],
      skipTrash: false
    });
    assert(delTrashRes.statusCode === 200 && delTrashRes.data.success, 'Delete to .trash API succeeded');
    assert(!fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'index_copy.php')), 'Removed from public_html');
    const trashFiles = fs.readdirSync(path.join(DOMAIN_ROOT, '.trash'));
    assert(trashFiles.some(f => f.includes('index_copy.php')), 'Item safely moved into .trash directory');

    // 16. Restore from Trash
    console.log('\n16. Testing Restore from Trash (/api/filemanager/restore-trash)...');
    const trashedItem = trashFiles.find(f => f.includes('index_copy.php'));
    const restoreTrashRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/restore-trash',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      items: [trashedItem]
    });
    assert(restoreTrashRes.statusCode === 200 && restoreTrashRes.data.success, 'Restore from trash API succeeded');
    assert(fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'index_copy.php')), 'Item restored back to public_html');

    // 17. Protected Domain Root Directory Safeguard
    console.log('\n17. Testing Protected Directory Boundary Guard at Domain Root...');
    const rootProtectRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/delete',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/',
      items: ['public_html'],
      skipTrash: true
    });
    assert(rootProtectRes.statusCode === 400, 'Blocked root public_html deletion with 400 Bad Request');
    assert(fs.existsSync(path.join(DOMAIN_ROOT, 'public_html')), 'public_html remains intact and protected');

    // 18. Permanent Bulk Multi-Select Deletion (Files + Folders with contents)
    console.log('\n18. Testing Bulk Multi-Select Permanent Delete (/api/filemanager/delete)...');
    const bulkDelRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/delete',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/public_html',
      items: ['test_audit_dir', 'test_extracted', 'test_audit.zip', 'stream_test.txt', 'index_copy.php'],
      skipTrash: true
    });
    assert(bulkDelRes.statusCode === 200 && bulkDelRes.data.success, 'Bulk delete API succeeded');
    assert(!fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'test_audit_dir')), 'test_audit_dir deleted from disk');
    assert(!fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'test_extracted')), 'test_extracted deleted from disk');
    assert(!fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'test_audit.zip')), 'test_audit.zip deleted from disk');
    assert(!fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'stream_test.txt')), 'stream_test.txt deleted from disk');
    assert(!fs.existsSync(path.join(DOMAIN_ROOT, 'public_html', 'index_copy.php')), 'index_copy.php deleted from disk');

    // 19. Restore Default Structure Verification
    console.log('\n19. Testing Restore Default Hosting Structure (/api/filemanager/restore-defaults)...');
    const restoreDefRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/restore-defaults',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN,
      path: '/'
    });
    assert(restoreDefRes.statusCode === 200 && restoreDefRes.data.success, 'Restore defaults API succeeded');

    // 20. Empty Trash
    console.log('\n20. Testing Empty Trash (/api/filemanager/empty-trash)...');
    const emptyTrashRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/filemanager/empty-trash',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: DOMAIN
    });
    assert(emptyTrashRes.statusCode === 200 && emptyTrashRes.data.success, 'Empty trash API succeeded');
    assert(fs.readdirSync(path.join(DOMAIN_ROOT, '.trash')).length === 0, 'Trash directory is completely empty on disk');

    console.log('\n====================================================');
    console.log('AUDIT SUMMARY: ' + passed + ' PASSED, ' + failed + ' FAILED');
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
