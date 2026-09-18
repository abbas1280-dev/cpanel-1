import urllib.request
import json
import subprocess

req = urllib.request.Request(
    'http://localhost:5173/api/pma-sso',
    data=json.dumps({'domain': 'turkyhub.com'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode('utf-8'))
token = data['token']
print("Token:", token)
print("Redirect URL:", data['redirectUrl'])

sh_script = f"""
rm -f /tmp/pma_cookies.txt /tmp/step1.log /tmp/step2.log
curl -s -i -c /tmp/pma_cookies.txt "http://127.0.0.1:8080/sso.php?token={token}" > /tmp/step1.log
head -n 20 /tmp/step1.log
echo "--- STEP 2 ---"
curl -s -L -b /tmp/pma_cookies.txt -c /tmp/pma_cookies.txt "http://127.0.0.1:8080/index.php?server=1" > /tmp/step2.log
head -n 40 /tmp/step2.log
"""

res = subprocess.run(['wsl', '-d', 'Ubuntu', '-u', 'root', 'bash', '-c', sh_script], capture_output=True, text=True)
print("WSL stdout:")
print(res.stdout)
if res.stderr:
    print("WSL stderr:", res.stderr)
