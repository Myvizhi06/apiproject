/**
 * API Sentinel - Settings Controller
 */

const config = require('../config/config');

let systemSettings = {
  allowedHosts: [...config.DEMO_ALLOWED_HOSTS],
  defaultTimeoutMs: 10000,
  defaultMaxRetries: 3,
  allowLocalNetwork: true,
  environment: process.env.NODE_ENV || 'development',
};

class SettingsController {
  static getSettings(req, res) {
    res.json({
      settings: systemSettings,
    });
  }

  static updateSettings(req, res) {
    const { allowedHosts, defaultTimeoutMs, defaultMaxRetries, allowLocalNetwork } = req.body;
    if (Array.isArray(allowedHosts)) {
      systemSettings.allowedHosts = allowedHosts;
    }
    if (defaultTimeoutMs !== undefined) {
      systemSettings.defaultTimeoutMs = Number(defaultTimeoutMs);
    }
    if (defaultMaxRetries !== undefined) {
      systemSettings.defaultMaxRetries = Number(defaultMaxRetries);
    }
    if (allowLocalNetwork !== undefined) {
      systemSettings.allowLocalNetwork = Boolean(allowLocalNetwork);
    }

    res.json({
      message: 'Settings updated successfully',
      settings: systemSettings,
    });
  }
}

module.exports = SettingsController;

