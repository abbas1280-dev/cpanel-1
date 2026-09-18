const { execSync } = require('child_process');
const ticket = JSON.stringify({ user: 'test', password: 'secret', expiresAt: Date.now() + 60000 });
execSync('wsl -d Ubuntu -u root bash -c "cat > /tmp/test_pipe.json; chmod 644 /tmp/test_pipe.json"', { input: ticket });
const out = execSync('wsl -d Ubuntu -u root cat /tmp/test_pipe.json', { encoding: 'utf-8' });
console.log('Result from pipe:', out);
