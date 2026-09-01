# MCP Setup - DuaVideoGenerator

## Installed MCP Servers

### 1. Filesystem MCP
- **Type:** Local (npx)
- **Path:** `H:\DuaVideoGenerator`
- **Use:** File read/write access
- **Status:** ✅ Working

### 2. GitHub MCP
- **Type:** Remote (GitHub hosted)
- **URL:** `https://api.githubcopilot.com/mcp/`
- **Use:** GitHub API - repos, PRs, issues
- **Status:** ✅ Working
- **Account:** h3lllsing

---

## How to Use

### Filesystem MCP
```
"main.py padho" → File read karega
"Naya file banao" → File create karega
"Code update karo" → File edit karega
```

### GitHub MCP
```
"Mere repos list karo" → Repos dikhayega
"Naya PR banao" → PR create karega
"Issue create karo" → Issue banayega
```

---

## Config Files

| File | Location |
|------|----------|
| Global Config | `C:\Users\MASOOD NASIR\.config\opencode\opencode.json` |
| Project Config | `H:\DuaVideoGenerator\opencode.json` |
| Documentation | `H:\MCP\README.md` |

---

## Token Management

- **Environment Variable:** `GITHUB_TOKEN`
- **Scope:** repo, workflow
- **Security:** Environment variable mein hai, config mein nahi

---

## Troubleshooting

### MCP not working?
1. Check config: `C:\Users\MASOOD NASIR\.config\opencode\opencode.json`
2. Check token: `[Environment]::GetEnvironmentVariable("GITHUB_TOKEN", "User")`
3. Restart opencode

### Filesystem access denied?
1. Check path in config
2. Restart opencode

### GitHub not connecting?
1. Check token validity
2. Check internet connection
3. Restart opencode
