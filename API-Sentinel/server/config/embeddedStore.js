const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// File-backed embedded JSON document database for zero-dependency local execution
class EmbeddedCollection {
  constructor(name, dataDir) {
    this.name = name;
    this.filePath = path.join(dataDir, `${name}.json`);
    this.records = [];
    this.lastMtime = 0;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const stat = fs.statSync(this.filePath);
        if (!this.lastMtime || stat.mtimeMs > this.lastMtime) {
          const raw = fs.readFileSync(this.filePath, 'utf8');
          this.records = JSON.parse(raw);
          this.lastMtime = stat.mtimeMs;
        }
      } else {
        this.records = [];
        this.save();
      }
    } catch (e) {
      this.records = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2), 'utf8');
      if (fs.existsSync(this.filePath)) {
        this.lastMtime = fs.statSync(this.filePath).mtimeMs;
      }
    } catch (e) {
      console.error(`Failed to persist embedded collection ${this.name}:`, e.message);
    }
  }

  generateId() {
    return crypto.randomBytes(12).toString('hex');
  }

  match(item, query) {
    if (!query || Object.keys(query).length === 0) return true;
    for (const key of Object.keys(query)) {
      if (key === '$or') {
        const orClauses = query.$or;
        const matchedOr = orClauses.some(subQuery => this.match(item, subQuery));
        if (!matchedOr) return false;
        continue;
      }
      const expected = query[key];
      const actual = item[key];
      if (typeof expected === 'object' && expected !== null) {
        if (expected.$regex) {
          const re = new RegExp(expected.$regex, expected.$options || '');
          if (!re.test(String(actual || ''))) return false;
        } else if (expected.$in) {
          if (!expected.$in.includes(actual)) return false;
        } else if (expected.$ne) {
          if (actual === expected.$ne) return false;
        } else if (expected.$gte) {
          if (new Date(actual) < new Date(expected.$gte)) return false;
        } else if (expected.$lte) {
          if (new Date(actual) > new Date(expected.$lte)) return false;
        }
      } else {
        if (actual !== expected && String(actual) !== String(expected)) return false;
      }
    }
    return true;
  }

  async find(query = {}) {
    this.load();
    const matched = this.records.filter(r => this.match(r, query));
    return new QueryCursor(matched.map(r => ({ ...r })));
  }

  async findOne(query = {}) {
    this.load();
    const item = this.records.find(r => this.match(r, query));
    return item ? { ...item } : null;
  }

  async findById(id) {
    this.load();
    const item = this.records.find(r => r._id === String(id) || r.id === String(id));
    return item ? { ...item } : null;
  }

  async create(data) {
    const doc = {
      _id: data._id || this.generateId(),
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      ...data,
    };
    this.records.push(doc);
    this.save();
    return { ...doc };
  }

  async findByIdAndUpdate(id, update, options = { new: true }) {
    const index = this.records.findIndex(r => r._id === String(id) || r.id === String(id));
    if (index === -1) return null;

    const current = this.records[index];
    const updatePayload = update.$set ? { ...update.$set } : { ...update };
    delete updatePayload._id;

    const updated = {
      ...current,
      ...updatePayload,
      updatedAt: new Date()
    };
    this.records[index] = updated;
    this.save();
    return { ...updated };
  }

  async findByIdAndDelete(id) {
    const index = this.records.findIndex(r => r._id === String(id) || r.id === String(id));
    if (index === -1) return null;
    const deleted = this.records.splice(index, 1)[0];
    this.save();
    return deleted;
  }

  async deleteMany(query = {}) {
    const initialLen = this.records.length;
    this.records = this.records.filter(r => !this.match(r, query));
    this.save();
    return { deletedCount: initialLen - this.records.length };
  }

  async countDocuments(query = {}) {
    return this.records.filter(r => this.match(r, query)).length;
  }
}

class QueryCursor {
  constructor(items) {
    this.items = items;
  }

  sort(sortCriteria) {
    if (!sortCriteria) return this;
    const [field, direction] = typeof sortCriteria === 'object'
      ? Object.entries(sortCriteria)[0]
      : [sortCriteria.replace(/^-/, ''), sortCriteria.startsWith('-') ? -1 : 1];

    this.items.sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va < vb) return direction === -1 ? 1 : -1;
      if (va > vb) return direction === -1 ? -1 : 1;
      return 0;
    });
    return this;
  }

  skip(count) {
    this.items = this.items.slice(count);
    return this;
  }

  limit(count) {
    this.items = this.items.slice(0, count);
    return this;
  }

  select() {
    return this;
  }

  populate() {
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.items).then(resolve, reject);
  }

  async exec() {
    return this.items;
  }
}

const os = require('os');

class EmbeddedStore {
  constructor() {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.dataDir = isServerless
      ? path.join(os.tmpdir(), 'api-sentinel-data')
      : path.join(__dirname, '../data');

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (e) {
      // In case __dirname is read-only on serverless, fallback to tmp
      this.dataDir = path.join(os.tmpdir(), 'api-sentinel-data');
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    }
    this.collections = {};
  }

  getCollection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new EmbeddedCollection(name, this.dataDir);
    }
    return this.collections[name];
  }
}

const embeddedStore = new EmbeddedStore();
module.exports = embeddedStore;

