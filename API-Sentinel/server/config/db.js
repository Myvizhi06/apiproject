/**
 * API Sentinel - Multi-Tier Database Connection Manager
 * Tier 1: Real MongoDB / MongoDB Atlas (via Mongoose)
 * Tier 2: In-memory MongoDB (via mongodb-memory-server if available)
 * Tier 3: Zero-dependency embedded document store (persisted to server/data/)
 */

const mongoose = require('mongoose');
const config = require('./config');
const embeddedStore = require('./embeddedStore');

let dbState = {
  isConnected: false,
  isMongoose: false,
  usingEmbedded: false,
  connectionUri: null,
};

async function connectDB() {
  if (dbState.isConnected) return dbState;

  // If memory DB explicitly requested or MONGODB_URI not set
  const uri = process.env.MONGODB_URI || config.MONGODB_URI;

  // 1. Try Real MongoDB connection (with appropriate timeout for cloud vs local)
  if (uri && !config.USE_MEMORY_DB) {
    const isCloud = uri.includes('mongodb+srv') || uri.includes('mongodb.net');
    const timeoutMs = isCloud ? 10000 : 2500;
    try {
      console.log(`[Database] Attempting connection to MongoDB at: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs,
      });

      dbState = {
        isConnected: true,
        isMongoose: true,
        usingEmbedded: false,
        connectionUri: uri,
      };
      console.log('[Database] Connected to external MongoDB successfully.');
      return dbState;
    } catch (mongoErr) {
      console.warn(`[Database] External MongoDB connection failed (${mongoErr.message}). Falling back to memory/embedded storage.`);
      try {
        await mongoose.disconnect();
      } catch (e) {}
    }
  }

  // 2. Try mongodb-memory-server if installed
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('[Database] Initializing mongodb-memory-server fallback...');
    const mongod = await MongoMemoryServer.create();
    const memoryUri = mongod.getUri();

    await mongoose.connect(memoryUri, {
      serverSelectionTimeoutMS: 3000,
    });

    dbState = {
      isConnected: true,
      isMongoose: true,
      usingEmbedded: false,
      connectionUri: memoryUri,
      memoryServer: mongod,
    };
    console.log('[Database] Connected to mongodb-memory-server in-memory instance.');
    return dbState;
  } catch (memErr) {
    // mongodb-memory-server not installed or binary unavailable
  }

  // 3. Guaranteed Tier 3 Fallback: Embedded document store
  console.log('[Database] Using zero-dependency embedded document store fallback (persisting to server/data/).');
  dbState = {
    isConnected: true,
    isMongoose: false,
    usingEmbedded: true,
    connectionUri: 'embedded://file-backed-store',
  };

  return dbState;
}

async function closeDB() {
  if (dbState.isMongoose) {
    try {
      await mongoose.disconnect();
    } catch (e) {}
    if (dbState.memoryServer) {
      try {
        await dbState.memoryServer.stop();
      } catch (e) {}
    }
  }
  dbState.isConnected = false;
}

function getDbState() {
  return { ...dbState };
}

module.exports = {
  connectDB,
  closeDB,
  getDbState,
};

