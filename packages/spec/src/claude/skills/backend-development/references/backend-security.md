# Backend Security

Security best practices, OWASP Top 10 mitigation, and modern security standards (2025).

## OWASP Top 10 (2025 RC1)

### New Entries (2025)
- **Supply Chain Failures** - Vulnerable dependencies, compromised packages
- **Mishandling of Exceptional Conditions** - Improper error handling exposing system info

### Top Vulnerabilities & Mitigation

#### 1. Broken Access Control
**Risk:** Users access unauthorized resources

**Mitigation:**
- Implement RBAC (Role-Based Access Control)
- Deny by default, explicitly allow
- Log access control failures
- Enforce authorization on backend (never client-side)
- Use JWT with proper claims validation

```typescript
// Good: Server-side authorization check
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async deleteUser(@Param('id') id: string) {
  // Verify user can access this resource
  return this.usersService.delete(id);
}
```

#### 2. Cryptographic Failures
**Risk:** Sensitive data exposure, weak encryption

**Mitigation:**
- Use Argon2id for password hashing (replaces bcrypt as of 2025)
- TLS 1.3 for data in transit
- Encrypt sensitive data at rest (AES-256)
- Use crypto.randomBytes() for tokens, not Math.random()
- Never store passwords in plain text

```python
# Good: Argon2id password hashing
from argon2 import PasswordHasher

ph = PasswordHasher()
hash = ph.hash("password123")  # Auto-salted, memory-hard
ph.verify(hash, "password123")  # Verify password
```

#### 3. Injection Attacks
**Risk:** SQL injection, NoSQL injection, command injection (6x increase 2020-2024)

**Mitigation:** Parameterized queries prevent SQL injection.
- Use parameterized queries ALWAYS
- Input validation with allow-lists
- Escape special characters
- Use ORMs properly (avoid raw queries)

```typescript
// Bad: Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// Good: Parameterized query
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);
```

#### 4. Insecure Design
**Risk:** Flawed architecture, missing security controls

**Mitigation:**
- Threat modeling during design phase
- Security requirements from start
- Principle of least privilege
- Defense in depth (multiple security layers)

#### 5. Security Misconfiguration
**Risk:** Default credentials, verbose errors, unnecessary features enabled

**Mitigation:**
- Remove default accounts
- Disable directory listing
- Use security headers (CSP, HSTS, X-Frame-Options)
- Minimize attack surface
- Regular security audits

```typescript
// Security headers middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

#### 6. Vulnerable Components
**Risk:** Outdated dependencies with known vulnerabilities

**Mitigation:**
- Regular dependency updates (npm audit, pip-audit)
- Use Dependabot/Renovate for automated updates
- Monitor CVE databases
- Software composition analysis (SCA) in CI/CD
- Lock file integrity checks

```bash
# Check for vulnerabilities
npm audit fix
pip-audit --fix
```

#### 7. Authentication Failures
**Risk:** Weak passwords, session hijacking, credential stuffing

**Mitigation:**
- MFA mandatory for admin accounts
- Rate limiting on login endpoints (10 attempts/minute)
- Strong password policies (12+ chars, complexity)
- Session timeout (15 mins idle, 8 hours absolute)
- FIDO2/WebAuthn for passwordless auth

#### 8. Software & Data Integrity Failures
**Risk:** CI/CD pipeline compromise, unsigned updates

**Mitigation:**
- Code signing for releases
- Verify integrity of packages (lock files)
- Secure CI/CD pipelines (immutable builds)
- Checksum verification

#### 9. Logging & Monitoring Failures
**Risk:** Breaches undetected, insufficient audit trail

**Mitigation:**
- Log authentication events (success/failure)
- Log access control failures
- Centralized logging (ELK Stack, Splunk)
- Alerting on suspicious patterns
- Log rotation and retention policies

#### 10. Server-Side Request Forgery (SSRF)
**Risk:** Server makes malicious requests to internal resources

**Mitigation:**
- Validate and sanitize URLs
- Allow-list for remote resources
- Network segmentation
- Disable unnecessary protocols (file://, gopher://)

## Input Validation (Prevents Vulnerabilities)

### Validation Strategies

**1. Type Validation**
```typescript
// Use class-validator with NestJS
class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password: string;

  @IsInt()
  @Min(18)
  age: number;
}
```

**2. Sanitization**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize HTML input
const clean = DOMPurify.sanitize(userInput);
```

**3. Allow-lists (Preferred over Deny-lists)**
```typescript
// Good: Allow-list approach
const allowedFields = ['name', 'email', 'age'];
const sanitized = Object.keys(input)
  .filter(key => allowedFields.includes(key))
  .reduce((obj, key) => ({ ...obj, [key]: input[key] }), {});
```

## Rate Limiting

### Token Bucket Algorithm (Industry Standard)

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

app.use('/api/', limiter);
```

### API-Specific Limits

- **Authentication:** 10 attempts/15 min
- **Public APIs:** 100 requests/15 min
- **Authenticated APIs:** 1000 requests/15 min
- **Admin endpoints:** 50 requests/15 min

## Security Headers

```typescript
// Essential security headers (2025)
{
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=()',
}
```

## Secrets Management

### Best Practices

1. **Never commit secrets** - Use .env files (gitignored)
2. **Environment-specific** - Different secrets per environment
3. **Rotation policy** - Rotate secrets every 90 days
4. **Encryption at rest** - Encrypt secrets in secret managers
5. **Least privilege** - Minimal permissions per secret

### Tools

- **HashiCorp Vault** - Multi-cloud, dynamic secrets
- **AWS Secrets Manager** - Managed service, auto-rotation
- **Azure Key Vault** - Integrated with Azure services
- **Pulumi ESC** - Unified secrets orchestration (2025 trend)

```typescript
// Good: Secrets from environment
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) throw new Error('DB_PASSWORD not set');
```

## Critical Security Invariants (apply only when the task touches these surfaces)

These invariants are lane-aware: enforce them for Critical tasks that touch the
named surface; for Direct/Standard tasks that happen to touch it, apply the same
checks with proportional evidence (targeted unit test + diff self-check for Direct,
bounded suite for Standard). Do not impose a fixed heavy ceremony on every task.

### Logging & Secret Redaction

- Match secret names by exact token boundaries, not broad substrings. Never redact
  by substring inside safe identifiers — e.g. names ending in `_file`, `_path`,
  `_hint`, `_label` or containing `tokenizer` must stay intact. Preserve the
  field/key name, replace only the value with `[REDACTED]` (use `[REDACTED-PEM]`
  for PEM blocks, keeping the surrounding structure).
- Leave public URLs and credential-free strings untouched. URL redaction applies
  only when a credential is present in the URL (e.g. `user:pass@host`).
- Authorization redaction is quote-aware and delimiter-safe: match schemes
  `Bearer`/`Basic` case-insensitively, redact only the credential that follows,
  preserve surrounding quotes and trailing delimiters (`,`, `;`, whitespace) outside
  the redacted value, and never drop the closing quote.
- Idempotence: `redact(redact(x)) === redact(x)`. The markers `[REDACTED]` /
  `[REDACTED-PEM]` are stable and not re-wrapped or corrupted.
- Verification guidance: cover true-positive credential cases, false-positive
  safe-identifier and public-URL cases, quoted `Bearer`/`Basic` with trailing
  delimiters, multi-line/PEM cases when relevant, and an idempotence round-trip.
  Assert that no secret appears in error messages or completion reports and that
  safe values are byte-identical after redaction.

### Filesystem Write Boundary

- Require an existing real directory as root. Reject before any mutation when
  `targetPath` is empty or whitespace-only, contains a URI scheme, is absolute,
  escapes via `..` segments, or escapes via sibling-prefix (`root` vs
  `root-evil`).
- Containment needs two checks: lexical containment of the resolved path
  (`path.resolve(root, target)` inside root) **and** `realpath` containment of
  the deepest existing parent directory. This blocks symlink-pointing-outside
  and traversal that lexical check alone would miss. Never follow or overwrite a
  symlink at the final target; never create parent directories outside root.
- Perform atomic same-directory write: create a temporary file in the target
  directory, write fully, then `rename` into place. Remove the temp file on any
  error. Rejections must happen before creating or modifying anything outside root.
- Return the canonical `realpath` of the target on success (e.g. macOS
  `/var` → `/private/var` alias must resolve). Keep the public API otherwise
  unchanged.
- Verification guidance: nested success, traversal / absolute / URI / sibling-prefix
  rejection, parent-symlink rejection, final-symlink rejection (do not follow or
  overwrite), no-outside-mutation assertion (filesystem outside root unchanged on
  failure), atomic temp cleanup, and canonical return-path equality. Critical runs
  the full project suite; Direct/Standard use proportional lane evidence (targeted
  unit test + diff self-check for Direct, bounded suite for Standard).

## API Security Checklist

- [ ] Use HTTPS/TLS 1.3 only
- [ ] Implement OAuth 2.1 + JWT for authentication
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all inputs
- [ ] Parameterized queries (prevent SQL injection)
- [ ] Security headers configured
- [ ] CORS properly configured (not `*` in production)
- [ ] API versioning implemented
- [ ] Error messages don't leak system info
- [ ] Logging authentication events
- [ ] MFA for admin accounts
- [ ] Regular security audits (quarterly)

## Common Security Pitfalls

1. **Client-side validation only** - Always validate on server
2. **Using Math.random() for tokens** - Use crypto.randomBytes()
3. **Storing passwords with bcrypt** - Use Argon2id (2025 standard)
4. **Trusting user input** - Validate and sanitize everything
5. **Weak CORS configuration** - Don't use `*` in production
6. **Insufficient logging** - Log all authentication/authorization events
7. **No rate limiting** - Implement on all public endpoints

## Resources

- **OWASP Top 10 (2025):** https://owasp.org/www-project-top-ten/
- **OWASP Cheat Sheets:** https://cheatsheetseries.owasp.org/
- **CWE Top 25:** https://cwe.mitre.org/top25/
- **NIST Guidelines:** https://www.nist.gov/cybersecurity
