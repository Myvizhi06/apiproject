/**
 * API Sentinel - Vercel Serverless Function Handler
 * Wraps Express application with resilient cold-start database connection & auto-seeding.
 */

const { createApp } = require('../API-Sentinel/server/app');
const { connectDB } = require('../API-Sentinel/server/config/db');

let isInitialized = false;
let initPromise = null;

async function initialize() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();
      try {
        const seed = require('../API-Sentinel/server/utils/seed');
        const { User } = require('../API-Sentinel/server/models');
        const demoExists = await User.findOne({ email: 'demo@apisentinel.dev' });
        if (!demoExists) {
          console.log('[Serverless] Seeding default academic demo operator...');
          await seed();
        }
      } catch (seedErr) {
        console.warn('[Serverless] Auto-seed check notice:', seedErr.message);
      }
      isInitialized = true;
    })();
  }
  await initPromise;
}

const app = createApp();

module.exports = async (req, res) => {
  try {
    await initialize();
  } catch (err) {
    console.error('[Serverless] Initialization error:', err);
  }
  return app(req, res);
};

