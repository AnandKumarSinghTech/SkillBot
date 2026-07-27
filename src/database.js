// src/database.js
// Sets up SQLite database with all required tables

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create /data folder if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'skillbot.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ── Create tables ──────────────────────────────────────────────

db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    email     TEXT    UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Sessions table (one per chat conversation)
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    title       TEXT DEFAULT 'New Chat',
    resume_text TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Messages table (stores full conversation history)
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL CHECK(role IN ('user','assistant')),
    content    TEXT    NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Progress table (learning roadmap items)
  CREATE TABLE IF NOT EXISTS progress (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    skill      TEXT    NOT NULL,
    completed  INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Helper functions ───────────────────────────────────────────

// Sessions
function createSession(sessionId, userId = null) {
  db.prepare(`
    INSERT OR IGNORE INTO sessions (id, user_id) VALUES (?, ?)
  `).run(sessionId, userId);
}

function getSession(sessionId) {
  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId);
}

function updateSessionTitle(sessionId, title) {
  db.prepare(`UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(title, sessionId);
}

function updateResumeText(sessionId, text) {
  db.prepare(`UPDATE sessions SET resume_text = ? WHERE id = ?`).run(text, sessionId);
}

// Messages
function addMessage(sessionId, role, content) {
  db.prepare(`INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`)
    .run(sessionId, role, content);
}

function getMessages(sessionId) {
  return db.prepare(`
    SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC
  `).all(sessionId);
}

// Progress
function addProgressItem(sessionId, skill) {
  const exists = db.prepare(`
    SELECT id FROM progress WHERE session_id = ? AND skill = ?
  `).get(sessionId, skill);
  if (!exists) {
    db.prepare(`INSERT INTO progress (session_id, skill) VALUES (?, ?)`).run(sessionId, skill);
  }
}

function getProgress(sessionId) {
  return db.prepare(`SELECT * FROM progress WHERE session_id = ? ORDER BY created_at ASC`)
    .all(sessionId);
}

function toggleProgress(progressId, completed) {
  db.prepare(`UPDATE progress SET completed = ? WHERE id = ?`).run(completed ? 1 : 0, progressId);
}

// Users
function createUser(name, email) {
  try {
    const result = db.prepare(`INSERT INTO users (name, email) VALUES (?, ?)`).run(name, email);
    return result.lastInsertRowid;
  } catch {
    return db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)?.id;
  }
}

module.exports = {
  createSession, getSession, updateSessionTitle, updateResumeText,
  addMessage, getMessages,
  addProgressItem, getProgress, toggleProgress,
  createUser
};
