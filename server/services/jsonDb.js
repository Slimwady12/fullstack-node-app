import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'database.json');
const TMP_PATH = path.join(process.cwd(), 'database.json.tmp');
const WRITE_DELAY = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY = 100;

let dbCache = null;
let writeQueue = [];
let isWriting = false;

function getDefaultDatabase() {
  const now = new Date().toISOString();
  return {
    users: [],
    aiChats: [],
    lawyers: [],
    templates: [],
    automations: [],
    documents: [],
    jobs: [],
    disputes: [],
    conversations: [],
    notifications: [],
    auditLogs: [],
    systemConfig: {
      ai: {
        openaiApiKey: '',
        defaultModel: 'gpt-5.4-mini',
        masterPrompt: 'You are a professional legal assistant for Uzbekistan. Provide accurate, concise, and helpful legal information in the requested language. Always cite relevant Uzbek laws when possible. If uncertain, advise consulting a licensed attorney.',
      },
      suggestionRules: {
        ratingThreshold: 4.0,
        specializationMatchWeight: 0.5,
        onlinePriority: true,
        responseTimeWeight: 0.3,
        maxSuggestions: 5,
      },
      featureFlags: {
        enableChat: true,
        enableJobs: true,
        enableLawyerSearch: true,
      },
    },
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function backfill(db) {
  let modified = false;

  if (!db.aiChats) {
    db.aiChats = [];
    modified = true;
    console.log('[jsonDb] Backfill: Added missing aiChats collection');
  }

  if (!Array.isArray(db.aiChats)) {
    db.aiChats = [];
    modified = true;
    console.log('[jsonDb] Backfill: Fixed aiChats type');
  }

  if (db.users && Array.isArray(db.users)) {
    for (const user of db.users) {
      if (!user.savedLawyers) {
        user.savedLawyers = [];
        modified = true;
        console.log(`[jsonDb] Backfill: Added savedLawyers for user ${user.id}`);
      }
    }
  }

  if (db.lawyers && Array.isArray(db.lawyers)) {
    for (const lawyer of db.lawyers) {
      if (lawyer.reviews && Array.isArray(lawyer.reviews)) {
        for (const review of lawyer.reviews) {
          if (!('userId' in review)) {
            review.userId = null;
            modified = true;
            console.log(`[jsonDb] Backfill: Added userId to review ${review.id}`);
          }
        }
      }
    }
  }

  if (db.automations && Array.isArray(db.automations)) {
    for (const automation of db.automations) {
      if (!('templateVersion' in automation) || automation.templateVersion === undefined) {
        automation.templateVersion = 1;
        modified = true;
        console.log(`[jsonDb] Backfill: Added templateVersion to automation ${automation.id}`);
      }
    }
  }

  if (db.documents && Array.isArray(db.documents)) {
    for (const doc of db.documents) {
      if (!('templateVersion' in doc) || doc.templateVersion === undefined) {
        doc.templateVersion = 1;
        modified = true;
        console.log(`[jsonDb] Backfill: Added templateVersion to document ${doc.id}`);
      }
    }
  }

  return modified;
}

function readFileSync() {
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Handle both formats: if file has data wrapper, unwrap it
    if (parsed && parsed.data && typeof parsed.data === 'object') {
      console.log('[jsonDb] Unwrapping data wrapper from file');
      return parsed.data;
    }
    
    return parsed;
  } catch (error) {
    console.error('[jsonDb] Failed to read database file:', error.message);
    throw new Error(`Database read failed: ${error.message}`);
  }
}

function writeFileSync(data) {
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(TMP_PATH, content, 'utf-8');
    fs.renameSync(TMP_PATH, DB_PATH);
    console.log('[jsonDb] Database written successfully');
  } catch (error) {
    console.error('[jsonDb] Failed to write database file:', error.message);
    try {
      if (fs.existsSync(TMP_PATH)) {
        fs.unlinkSync(TMP_PATH);
      }
    } catch (cleanupError) {
      console.error('[jsonDb] Failed to cleanup temp file:', cleanupError.message);
    }
    throw new Error(`Database write failed: ${error.message}`);
  }
}

async function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) {
    return;
  }

  isWriting = true;

  while (writeQueue.length > 0) {
    const { data, resolve, reject } = writeQueue.shift();
    try {
      writeFileSync(data);
      dbCache = deepClone(data);
      resolve();
    } catch (error) {
      reject(error);
    }
  }

  isWriting = false;
}

function scheduleWrite(data) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ data, resolve, reject });

    if (!isWriting) {
      setTimeout(() => processWriteQueue(), WRITE_DELAY);
    }
  });
}

function init() {
  console.log('[jsonDb] Initializing database...');

  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('[jsonDb] Database file not found, creating default...');
      const defaultDb = getDefaultDatabase();
      writeFileSync(defaultDb);
      dbCache = deepClone(defaultDb);
      console.log('[jsonDb] Default database created successfully');
      return dbCache;
    }

    const rawDb = readFileSync();
    dbCache = deepClone(rawDb);

    const backfillModified = backfill(dbCache);

    if (backfillModified) {
      console.log('[jsonDb] Backfill applied, writing updated database...');
      writeFileSync(dbCache);
      console.log('[jsonDb] Backfill complete');
    }

    console.log('[jsonDb] Database initialized successfully');
    return dbCache;
  } catch (error) {
    console.error('[jsonDb] Initialization failed:', error.message);
    throw error;
  }
}

function read() {
  if (!dbCache) {
    throw new Error('Database not initialized. Call init() first.');
  }
  console.log('[jsonDb] Reading database');
  return deepClone(dbCache);
}

async function write(data) {
  if (!dbCache) {
    throw new Error('Database not initialized. Call init() first.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: must be an object');
  }

  console.log('[jsonDb] Queuing write operation');
  return scheduleWrite(data);
}

async function transaction(fn) {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const db = read();
      const result = fn(db);

      if (result && typeof result.then === 'function') {
        await result;
      }

      await write(db);
      return result;
    } catch (error) {
      retries++;
      console.warn(`[jsonDb] Transaction failed (attempt ${retries}/${MAX_RETRIES}):`, error.message);

      if (retries >= MAX_RETRIES) {
        throw new Error(`Transaction failed after ${MAX_RETRIES} retries: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
    }
  }
}

function getCollection(collectionName) {
  const db = read();
  if (!db[collectionName]) {
    throw new Error(`Collection '${collectionName}' not found in database`);
  }
  return db[collectionName];
}

function addToCollection(collectionName, item) {
  return transaction((db) => {
    if (!db[collectionName]) {
      throw new Error(`Collection '${collectionName}' not found in database`);
    }
    db[collectionName].push(item);
  });
}

function updateInCollection(collectionName, id, updateFn) {
  return transaction((db) => {
    if (!db[collectionName]) {
      throw new Error(`Collection '${collectionName}' not found in database`);
    }
    const index = db[collectionName].findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id '${id}' not found in '${collectionName}'`);
    }
    db[collectionName][index] = updateFn(db[collectionName][index]);
  });
}

function removeFromCollection(collectionName, id) {
  return transaction((db) => {
    if (!db[collectionName]) {
      throw new Error(`Collection '${collectionName}' not found in database`);
    }
    const index = db[collectionName].findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id '${id}' not found in '${collectionName}'`);
    }
    db[collectionName].splice(index, 1);
  });
}

export {
  init,
  read,
  write,
  transaction,
  getCollection,
  addToCollection,
  updateInCollection,
  removeFromCollection,
  getDefaultDatabase,
  backfill,
  DB_PATH,
};
