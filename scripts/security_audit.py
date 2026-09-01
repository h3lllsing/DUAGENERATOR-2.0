"""Security Audit Script"""
import json
import sys
from pathlib import Path

# Use absolute path to project root
PROJECT = Path(__file__).resolve().parent.parent
findings = []

print('=== Security Audit ===')
print(f'Project: {PROJECT}')
print()

# Test 1: Path traversal check
print('1. Path Traversal Test:')
test_paths = [
    '../../etc/passwd',
    '../../../windows/system32/config/sam',
    '/etc/shadow',
]
for p in test_paths:
    full = (PROJECT / p).resolve()
    safe = full.is_relative_to(PROJECT)
    status = 'SAFE' if safe else 'VULNERABLE'
    if not safe:
        findings.append(f'Path traversal: {p}')
    print(f'  {p}: {status}')

print()

# Test 2: Auth token check
print('2. Auth Token Check:')
auth_path = PROJECT / 'remotion/dashboard/auth.json'
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
gitignore_path = PROJECT / '.gitignore'
if gitignore_path.exists():
    gitignore = gitignore_path.read_text()
    secrets = ['client_secret.json', 'auth.json', '*.pem', '*.key']
    for s in secrets:
        if s in gitignore:
            print(f'  {s}: PROTECTED')
        else:
            print(f'  {s}: NOT PROTECTED')
            findings.append(f'Gitignore missing: {s}')
else:
    print('  .gitignore not found')
    findings.append('.gitignore not found')

print()

# Test 4: Security headers check
print('4. Security Headers (server.js):')
server_path = PROJECT / 'remotion/dashboard/server.js'
if server_path.exists():
    server = server_path.read_text()
    headers = ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection', 'Referrer-Policy']
    for h in headers:
        if h in server:
            print(f'  {h}: PRESENT')
        else:
            print(f'  {h}: MISSING')
            findings.append(f'Missing header: {h}')
else:
    print('  server.js not found')
    findings.append('server.js not found')

print()

# Test 5: Input validation check
print('5. Input Validation:')
render_path = PROJECT / 'remotion/dashboard/routes/render.js'
if render_path.exists():
    render = render_path.read_text(encoding='utf-8', errors='replace')
    checks = ['path.basename', 'startsWith(OUT)', 'escapeHtml', 'sanitizeTts']
    for c in checks:
        if c in render:
            print(f'  {c}: PRESENT')
        else:
            print(f'  {c}: MISSING')
            findings.append(f'Missing validation: {c}')
else:
    print('  render.js not found')

print()

# Test 6: Rate limiting check
print('6. Rate Limiting:')
if server_path.exists():
    server = server_path.read_text(encoding='utf-8', errors='replace')
    if 'checkRateLimit' in server:
        print('  Rate limiter: PRESENT')
        if '/^\\/api\\//' in server:
            print('  Scope: ALL POST /api/*')
        else:
            print('  Scope: SPECIFIC routes only')
    else:
        print('  Rate limiter: MISSING')
        findings.append('Rate limiter missing')

print()

# Test 7: XSS protection check
print('7. XSS Protection:')
app_path = PROJECT / 'remotion/dashboard/public/app.js'
if app_path.exists():
    app = app_path.read_text(encoding='utf-8', errors='replace')
    if 'escapeHtml' in app or 'escHtml' in app:
        print('  HTML escaping: PRESENT')
    else:
        print('  HTML escaping: MISSING')
        findings.append('HTML escaping missing')
else:
    print('  app.js not found')

print()

# Summary
print('=== Security Audit Complete ===')
if findings:
    print(f'\nFindings: {len(findings)} issues found')
    for f in findings:
        print(f'  - {f}')
    sys.exit(1)
else:
    print('\nNo issues found - all checks passed!')
    sys.exit(0)
