require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/api_sentinel',
  USE_MEMORY_DB: process.env.USE_MEMORY_DB === 'true' || false,
  JWT_SECRET: process.env.JWT_SECRET || 'api_sentinel_super_secret_jwt_key_2026_academic_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DEMO_ALLOWED_HOSTS: ['127.0.0.1', 'localhost', '127.0.0.1:5000', 'localhost:5000'],
  EXECUTION_TIMEOUT_MS: 300000, // 5 minutes max workflow runtime
  MAX_STEPS_PER_WORKFLOW: 25,
  MAX_RETRIES_LIMIT: 5,
};

