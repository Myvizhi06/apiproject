/**
 * API Sentinel - Execution Model
 */

const mongoose = require('mongoose');
const embeddedStore = require('../config/embeddedStore');
const { getDbState } = require('../config/db');

const ExecutionSchema = new mongoose.Schema(
  {
    workflowId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    workflowName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'RUNNING',
      index: true,
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    steps: { type: Array, default: [] },
    finalResult: { type: Object, default: {} },
    fsmHistory: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const MongooseExecution = mongoose.models.Execution || mongoose.model('Execution', ExecutionSchema);

class ExecutionModel {
  static get collection() {
    return embeddedStore.getCollection('executions');
  }

  static async find(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseExecution.find(query);
    }
    return this.collection.find(query);
  }

  static async findById(id) {
    if (getDbState().isMongoose) {
      return MongooseExecution.findById(id);
    }
    return this.collection.findById(id);
  }

  static async findOne(query) {
    if (getDbState().isMongoose) {
      return MongooseExecution.findOne(query);
    }
    return this.collection.findOne(query);
  }

  static async create(data) {
    if (getDbState().isMongoose) {
      return MongooseExecution.create(data);
    }
    return this.collection.create(data);
  }

  static async findByIdAndUpdate(id, update, options = { new: true }) {
    if (getDbState().isMongoose) {
      return MongooseExecution.findByIdAndUpdate(id, update, options);
    }
    return this.collection.findByIdAndUpdate(id, update, options);
  }

  static async countDocuments(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseExecution.countDocuments(query);
    }
    return this.collection.countDocuments(query);
  }

  static async deleteMany(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseExecution.deleteMany(query);
    }
    return this.collection.deleteMany(query);
  }
}

module.exports = ExecutionModel;

