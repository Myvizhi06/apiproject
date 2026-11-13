/**
 * API Sentinel - User Model
 */

const mongoose = require('mongoose');
const embeddedStore = require('../config/embeddedStore');
const { getDbState } = require('../config/db');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const MongooseUser = mongoose.models.User || mongoose.model('User', UserSchema);

class UserModel {
  static get collection() {
    return embeddedStore.getCollection('users');
  }

  static async findOne(query) {
    if (getDbState().isMongoose) {
      return MongooseUser.findOne(query);
    }
    return this.collection.findOne(query);
  }

  static async findById(id) {
    if (getDbState().isMongoose) {
      return MongooseUser.findById(id);
    }
    return this.collection.findById(id);
  }

  static async create(data) {
    if (getDbState().isMongoose) {
      return MongooseUser.create(data);
    }
    return this.collection.create(data);
  }

  static async find(query) {
    if (getDbState().isMongoose) {
      return MongooseUser.find(query);
    }
    return this.collection.find(query);
  }

  static async countDocuments(query) {
    if (getDbState().isMongoose) {
      return MongooseUser.countDocuments(query);
    }
    return this.collection.countDocuments(query);
  }

  static async deleteMany(query) {
    if (getDbState().isMongoose) {
      return MongooseUser.deleteMany(query);
    }
    return this.collection.deleteMany(query);
  }
}

module.exports = UserModel;

