# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. **Do NOT** share the vulnerability publicly
3. **Email** the maintainer directly with details
4. **Wait** for a response before disclosing

---

## Security Features

### Authentication
- Dashboard uses bearer token authentication
- YouTube OAuth tokens stored securely
- API keys stored in environment variables

### Encryption
- AES-128-CBC encryption for sensitive data
- PBKDF2-HMAC-SHA256 key derivation
- 600,000 iterations for key stretching

### Data Protection
- `.gitignore` excludes sensitive files:
  - `client_secret.json`
  - `tokens.json`
  - `auth.json`
  - `ai_api_config.json`
  - `security/` folder

### Network Security
- HTTPS for all external API calls
- Token-based authentication
- Rate limiting on API endpoints

---

## Best Practices

### For Users
1. **Never commit** API keys or tokens
2. **Use environment variables** for secrets
3. **Rotate tokens** periodically
4. **Use strong passwords** for dashboard

### For Developers
1. **Never hardcode** credentials
2. **Validate inputs** before processing
3. **Use parameterized queries** for database
4. **Log security events** for auditing

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GITHUB_TOKEN` | GitHub API access | Optional |
| `YOUTUBE_CLIENT_ID` | YouTube API | Optional |
| `YOUTUBE_CLIENT_SECRET` | YouTube API | Optional |
| `AI_API_KEY` | AI API access | Optional |
| `DASHBOARD_AUTH_TOKEN` | Dashboard security | Recommended |

---

## File Security

### Files to NEVER Commit
```
client_secret.json
tokens.json
auth.json
ai_api_config.json
.env
*.pem
*.key
security/
```

### Files Safe to Commit
```
.env.example
config.py
README.md
*.py (source code)
```

---

## Incident Response

If you suspect a security breach:

1. **Immediately** rotate all affected tokens
2. **Check** GitHub for unauthorized commits
3. **Review** access logs
4. **Notify** users if data was exposed
5. **Document** the incident

---

## Contact

For security issues, contact:
- Author: MASOOD NASIR
- GitHub: https://github.com/h3lllsing
