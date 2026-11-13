/**
 * API Sentinel - Workflow Model
 */

const mongoose = require('mongoose');
const embeddedStore = require('../config/embeddedStore');
const { getDbState } = require('../config/db');

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    steps: { type: Array, default: [] },
    workflowDefinition: { type: String, default: '' },
    ownerId: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const MongooseWorkflow = mongoose.models.Workflow || mongoose.model('Workflow', WorkflowSchema);

class WorkflowModel {
  static get collection() {
    return embeddedStore.getCollection('workflows');
  }

  static async find(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.find(query);
    }
    return this.collection.find(query);
  }

  static async findOne(query) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.findOne(query);
    }
    return this.collection.findOne(query);
  }

  static async findById(id) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.findById(id);
    }
    return this.collection.findById(id);
  }

  static async create(data) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.create(data);
    }
    return this.collection.create(data);
  }

  static async findByIdAndUpdate(id, update, options = { new: true }) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.findByIdAndUpdate(id, update, options);
    }
    return this.collection.findByIdAndUpdate(id, update, options);
  }

  static async findByIdAndDelete(id) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.findByIdAndDelete(id);
    }
    return this.collection.findByIdAndDelete(id);
  }

  static async countDocuments(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.countDocuments(query);
    }
    return this.collection.countDocuments(query);
  }

  static async deleteMany(query = {}) {
    if (getDbState().isMongoose) {
      return MongooseWorkflow.deleteMany(query);
    }
    return this.collection.deleteMany(query);
  }
}

module.exports = WorkflowModel;

