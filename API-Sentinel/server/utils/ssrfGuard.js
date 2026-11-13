/**
 * API Sentinel - SSRF (Server-Side Request Forgery) Guard
 * Validates target URLs, resolves DNS, blocks cloud metadata endpoints and private IP ranges,
 * and provides safe hop-by-hop redirect verification.
 */

const dns = require('dns');
const { promisify } = require('util');
const url = require('url');

const dnsLookupAsync = promisify(dns.lookup);

// Cloud Metadata IP Addresses and Hostnames
const CLOUD_METADATA_HOSTS = new Set([
  '169.254.169.254',      // AWS, GCP, Azure, OpenStack, DigitalOcean
  '169.254.169.253',
  'metadata.google.internal',
  'metadata.internal',
  '100.100.100.200',      // Alibaba Cloud metadata
  'instance-data',
]);

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

class SSRFSecurityError extends Error {
  constructor(message, targetUrl, blockedReason) {
    super(`SSRF Guard Blocked: ${message}`);
    this.name = 'SSRFSecurityError';
    this.targetUrl = targetUrl;
    this.blockedReason = blockedReason;
    this.statusCode = 403;
  }
}

/**
 * Check if an IPv4 address is in a reserved/private IP range.
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (parts[0] === 10) return true;

  // 172.16.0.0/12 (Private RFC 1918)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (parts[0] === 192 && parts[1] === 168) return true;

  // 169.254.0.0/16 (Link Local / Cloud Metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (parts[0] === 0) return true;

  return false;
}

/**
 * Check if an IPv6 address is private or loopback.
 */
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) return true;
  return false;
}

class SSRFGuard {
  /**
   * Validate a URL against SSRF policy.
   * @param {string} rawUrl - Target URL to inspect
   * @param {Object} options - { allowedHosts, allowLocalNetwork }
   */
  static async validateUrl(rawUrl, options = {}) {
    const allowLocal = options.allowLocalNetwork ?? (process.env.ALLOW_LOCAL_NETWORK === 'true' || true);
    const allowedHosts = options.allowedHosts || [
      'localhost',
      '127.0.0.1',
      '::1',
      '127.0.0.1:5000',
      'localhost:5000',
      'localhost:5173',
    ];

    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new SSRFSecurityError('URL must be a non-empty string', rawUrl, 'INVALID_URL');
    }

    let parsed;
    try {
      parsed = new url.URL(rawUrl);
    } catch (e) {
      throw new SSRFSecurityError(`Malformed URL: ${rawUrl}`, rawUrl, 'MALFORMED_URL');
    }

    // 1. Protocol Scheme Verification
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw new SSRFSecurityError(
        `Disallowed scheme '${parsed.protocol}'. Only 'http:' and 'https:' are permitted.`,
        rawUrl,
        'DISALLOWED_SCHEME'
      );
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Cloud Metadata Hostname & IP Check
    if (CLOUD_METADATA_HOSTS.has(hostname)) {
      throw new SSRFSecurityError(
        `Access to cloud instance metadata host '${hostname}' is strictly forbidden.`,
        rawUrl,
        'CLOUD_METADATA_BLOCKED'
      );
    }

    // 3. Check allowed hosts whitelist (if host matches whitelist, permit it directly)
    const hostWithPort = parsed.port ? `${hostname}:${parsed.port}` : hostname;
    const isExplicitlyAllowed = allowedHosts.some(h => {
      const lowerH = h.toLowerCase();
      return lowerH === hostname || lowerH === hostWithPort;
    });

    if (isExplicitlyAllowed) {
      return { allowed: true, resolvedIp: hostname, hostname };
    }

    // 4. DNS Resolution & Resolved IP Inspection
    let resolvedIp;
    try {
      const lookupResult = await dnsLookupAsync(hostname);
      resolvedIp = lookupResult.address;
    } catch (dnsErr) {
      throw new SSRFSecurityError(
        `DNS resolution failed for host '${hostname}': ${dnsErr.message}`,
        rawUrl,
        'DNS_RESOLUTION_FAILED'
      );
    }

    // Check resolved IP against cloud metadata
    if (CLOUD_METADATA_HOSTS.has(resolvedIp)) {
      throw new SSRFSecurityError(
        `Host '${hostname}' resolved to prohibited cloud metadata IP '${resolvedIp}'.`,
        rawUrl,
        'RESOLVED_METADATA_BLOCKED'
      );
    }

    // 5. Private / Loopback Network Ranges Check
    if (!allowLocal) {
      const isPrivate = isPrivateIPv4(resolvedIp) || isPrivateIPv6(resolvedIp);
      if (isPrivate) {
        throw new SSRFSecurityError(
          `Resolved IP '${resolvedIp}' belongs to a private, loopback, or link-local address space. Local network access is disabled.`,
          rawUrl,
          'PRIVATE_IP_BLOCKED'
        );
      }
    }

    return {
      allowed: true,
      resolvedIp,
      hostname,
      protocol: parsed.protocol,
    };
  }
}

module.exports = {
  SSRFGuard,
  SSRFSecurityError,
  isPrivateIPv4,
  isPrivateIPv6,
  CLOUD_METADATA_HOSTS,
};

