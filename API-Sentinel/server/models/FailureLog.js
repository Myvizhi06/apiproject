/**
 * API Sentinel - FailureLog Model
 */

const mongoose = require('mongoose');
const embeddedStore = require('../config/embeddedStore');
const { getDbState } = require('../config/db');

const FailureLogSchema = new mongoose.Schema(
  {
    executionId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    workflowId: { type: String, default: null },
    stepId: { type: String, required: true },
    stepName: { type: String, default: '' },
    failureType: { type: String, required: true, index: true },
    errorMessage: { type: String, default: '' },
    recoveryAction: { type: String, default: 'RETRY' },
    retryCount: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const MongooseFailureLog = mongoose.models.FailureLog || mongoose.model('FailureLog', FailureLogSchema);

class FailureLogModel {
  static get collection() {
    return embeddedStore.getCollection('failure_logs');
  }

  static async find(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseFailureLog.find(query);
    }
    return this.collection.find(query);
  }

  static async findById(id) {
    if (getDbState().isMongoose) {
      return MongooseFailureLog.findById(id);
    }
    return this.collection.findById(id);
  }

  static async create(data) {
    if (getDbState().isMongoose) {
      return MongooseFailureLog.create(data);
    }
    return this.collection.create(data);
  }

  static async countDocuments(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseFailureLog.countDocuments(query);
    }
    return this.collection.countDocuments(query);
  }

  static async deleteMany(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseFailureLog.deleteMany(query);
    }
    return this.collection.deleteMany(query);
  }
}

module.exports = FailureLogModel;

