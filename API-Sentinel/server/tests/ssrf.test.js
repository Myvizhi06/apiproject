const { SSRFGuard, SSRFSecurityError, CLOUD_METADATA_HOSTS } = require('../utils/ssrfGuard');

describe('SSRF Guard & Network Security', () => {
  test('allows approved localhost and 127.0.0.1 target URLs', async () => {
    const result = await SSRFGuard.validateUrl('http://127.0.0.1:5000/api/demo/login', {
      allowedHosts: ['127.0.0.1', 'localhost', '127.0.0.1:5000'],
      allowLocalNetwork: true,
    });
    expect(result.allowed).toBe(true);
  });

  test('blocks AWS/GCP/Azure instance metadata IP (169.254.169.254)', async () => {
    await expect(
      SSRFGuard.validateUrl('http://169.254.169.254/latest/meta-data/', {
        allowLocalNetwork: true,
      })
    ).rejects.toThrow(SSRFSecurityError);

    await expect(
      SSRFGuard.validateUrl('http://169.254.169.254/computeMetadata/v1/', {
        allowLocalNetwork: true,
      })
    ).rejects.toThrow(/cloud instance metadata/);
  });

  test('blocks non-HTTP protocols (file, ftp, gopher, ldap)', async () => {
    await expect(SSRFGuard.validateUrl('file:///etc/passwd')).rejects.toThrow(/Disallowed scheme/);
    await expect(SSRFGuard.validateUrl('ftp://example.com/file')).rejects.toThrow(/Disallowed scheme/);
    await expect(SSRFGuard.validateUrl('gopher://example.com:70/')).rejects.toThrow(/Disallowed scheme/);
  });

  test('blocks private RFC 1918 addresses when allowLocalNetwork is false', async () => {
    await expect(
      SSRFGuard.validateUrl('http://10.0.0.1/admin', {
        allowLocalNetwork: false,
        allowedHosts: [],
      })
    ).rejects.toThrow(/private, loopback, or link-local/);

    await expect(
      SSRFGuard.validateUrl('http://192.168.1.1/router', {
        allowLocalNetwork: false,
        allowedHosts: [],
      })
    ).rejects.toThrow(/private, loopback, or link-local/);
  });

  test('rejects malformed or empty URLs', async () => {
    await expect(SSRFGuard.validateUrl('')).rejects.toThrow(SSRFSecurityError);
    await expect(SSRFGuard.validateUrl('not-a-valid-url')).rejects.toThrow(/Malformed URL/);
  });
});

