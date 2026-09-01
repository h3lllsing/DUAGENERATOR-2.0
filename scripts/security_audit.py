"""Security Audit Script"""
import json
from pathlib import Path

print('=== Security Audit ===')
print()

# Test 1: Path traversal check
print('1. Path Traversal Test:')
PROJECT = Path('.').resolve()
test_paths = [
    '../../etc/passwd',
    '../../../windows/system32/config/sam',
    '/etc/shadow',
]
for p in test_paths:
    full = PROJECT / p
    safe = str(full).startswith(str(PROJECT))
    status = 'SAFE' if safe else 'VULNERABLE'
    print(f'  {p}: {status}')

print()

# Test 2: Auth token check
print('2. Auth Token Check:')
auth_path = Path('remotion/dashboard/auth.json')
if auth_path.exists():
    with open(auth_path) as f:
        data = json.load(f)
    token = data.get('token', '')
    print(f'  Token length: {len(token)} chars')
    is_hex = all(c in '0123456789abcdef' for c in token)
    print(f'  Token is hex: {is_hex}')
    print(f'  Token is random: {len(set(token)) > 10}')
else:
    print('  Auth file not found')

print()

# Test 3: .gitignore check
print('3. .gitignore Check:')
gitignore = Path('.gitignore').read_text()
secrets = ['client_secret.json', 'auth.json', '*.pem', '*.key']
for s in secrets:
    if s in gitignore:
        print(f'  {s}: PROTECTED')
    else:
        print(f'  {s}: NOT PROTECTED')

print()

# Test 4: Security headers check
print('4. Security Headers (server.js):')
server = Path('remotion/dashboard/server.js').read_text()
headers = ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection', 'Referrer-Policy']
for h in headers:
    if h in server:
        print(f'  {h}: PRESENT')
    else:
        print(f'  {h}: MISSING')

print()

# Test 5: Input validation check
print('5. Input Validation:')
render = Path('remotion/dashboard/routes/render.js').read_text(encoding='utf-8', errors='replace')
checks = ['path.basename', 'startsWith(OUT)', 'escapeHtml', 'sanitizeTts']
for c in checks:
    if c in render:
        print(f'  {c}: PRESENT')
    else:
        print(f'  {c}: MISSING')

print()

# Test 6: Rate limiting check
print('6. Rate Limiting:')
server = Path('remotion/dashboard/server.js').read_text(encoding='utf-8', errors='replace')
if 'checkRateLimit' in server:
    print('  Rate limiter: PRESENT')
    if '/^\\/api\\//' in server:
        print('  Scope: ALL POST /api/*')
    else:
        print('  Scope: SPECIFIC routes only')
else:
    print('  Rate limiter: MISSING')

print()

# Test 7: XSS protection check
print('7. XSS Protection:')
app = Path('remotion/dashboard/public/app.js').read_text(encoding='utf-8', errors='replace')
if 'escapeHtml' in app or 'escHtml' in app:
    print('  HTML escaping: PRESENT')
else:
    print('  HTML escaping: MISSING')

print()
print('=== Security Audit Complete ===')
