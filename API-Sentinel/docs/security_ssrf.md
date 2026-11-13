# SSRF (Server-Side Request Forgery) Security Model & Defense-in-Depth

## 1. Threat Model & Risk Analysis
In an automated API testing platform where users supply custom target URLs, **Server-Side Request Forgery (SSRF)** represents a critical threat. Without strict controls, an attacker or compromised workflow could instruct the execution server to:
1. Probe internal microservices, admin consoles, and databases bound only to localhost (`127.0.0.1`) or private subnets (`10.0.0.0/8`, `192.168.0.0/16`).
2. Query cloud instance metadata services (e.g. AWS `http://169.254.169.254/latest/meta-data/`) to steal IAM roles, temporary security credentials, and private keys.
3. Exploit internal protocol smuggling (e.g., using `gopher://`, `file://`, or `ldap://` to communicate with internal Redis or Memcached instances).
4. Perform DNS Rebinding attacks to bypass initial hostname checks.

---

## 2. Multi-Layered Defense-in-Depth Architecture

API Sentinel implements a 5-layer SSRF Guard (`server/utils/ssrfGuard.js`):

```
Target URL ──► [Layer 1: Scheme Validation (http / https only)]
                     │
                     ▼
              [Layer 2: Cloud Metadata Hostname & IP Blacklist]
                     │
                     ▼
              [Layer 3: Allowlist Matching] ──(Matched)──► ALLOWED
                     │ (Not in allowlist)
                     ▼
              [Layer 4: DNS Resolution & Resolved IP Inspection]
                     │
                     ▼
              [Layer 5: Hop-by-Hop Redirect Validation (max 5 hops)]
```

### Layer 1: Protocol Scheme Whitelisting
Only `http:` and `https:` schemes are permitted. Schemes such as `file:`, `ftp:`, `gopher:`, `ldap:`, `dict:`, `data:`, and `javascript:` are immediately rejected with an `SSRFSecurityError`.

### Layer 2: Cloud Instance Metadata Protection
The following cloud metadata hostnames and IP addresses are hard-blocked unconditionally:
- `169.254.169.254` (AWS EC2, Google Cloud, Azure, OpenStack, DigitalOcean metadata)
- `169.254.169.253` (Cloud internal DHCP / DNS services)
- `metadata.google.internal` (GCP internal metadata)
- `100.100.100.200` (Alibaba Cloud instance metadata)
- `instance-data` (Legacy EC2 metadata DNS alias)

### Layer 3: Host Allowlist & Configurable Boundary
In production environments, target hosts must match the approved allowlist (e.g., designated staging domains and the local mock server). Private RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and loopback (`127.0.0.0/8`) are blocked by default unless explicitly permitted in development/test mode via `ALLOW_LOCAL_NETWORK=true`.

### Layer 4: DNS Resolution & IP Range Validation
Hostname checks alone are vulnerable to DNS Rebinding (where a public domain resolves to a private IP). The guard explicitly calls `dns.lookup()` and inspects the resolved IPv4/IPv6 address:
- Disallows loopback (`127.0.0.1`, `::1`)
- Disallows link-local (`169.254.0.0/16`, `fe80::/10`)
- Disallows private addresses when local network access is disabled

### Layer 5: Safe Hop-by-Hop Redirect Verification
HTTP clients often follow redirects automatically (`301`, `302`, `307`), which attackers use to bypass initial validation (e.g. redirecting from `https://allowed.com/redirect` to `http://169.254.169.254`).
In API Sentinel:
- Axios is configured with `maxRedirects: 0` (automatic redirects disabled).
- If a 3xx status is returned, the redirect destination URL is extracted from the `Location` header.
- The new destination URL is passed through the complete 5-layer SSRF Guard again before any follow-up request is initiated, capped at a maximum of 5 hops.

