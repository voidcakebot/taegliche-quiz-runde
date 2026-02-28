const fs = require('fs');

const CHARACTERS = [
  'Sir Nebelzahn',
  'Lady Funkenflug',
  'Bruder Kicherklinge',
  'Nyra Mondfeder',
  'Rokk Eisenwitz',
  'Kael Schattenhelm'
];

class FileStorage {
  constructor(path) { this.path = path; }
  load() {
    if (!fs.existsSync(this.path)) return { users: {}, questions: {} };
    try {
      const d = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      d.users ||= {}; d.questions ||= {};
      return d;
    } catch { return { users: {}, questions: {} }; }
  }
  save(data) { fs.writeFileSync(this.path, JSON.stringify(data, null, 2)); }

  async init() {}

  async bootstrap() {
    const s = this.load();
    const taken = Object.keys(s.users);
    const leaderboard = Object.entries(s.users)
      .map(([character, u]) => ({ character, points: Number(u.points || 0) }))
      .sort((a,b)=>b.points-a.points)
      .slice(0, 20);
    return { characters: CHARACTERS, taken, leaderboard };
  }

  async register({ character, password }) {
    const s = this.load();
    if (!CHARACTERS.includes(character)) return { ok:false, error:'UNKNOWN_CHARACTER' };
    if (s.users[character]) return { ok:false, error:'CHARACTER_TAKEN' };
    s.users[character] = { password, points: 0, createdAt: new Date().toISOString(), lastAnsweredKey: null };
    this.save(s);
    return { ok:true };
  }

  async login({ character, password }) {
    const s = this.load();
    const u = s.users[character];
    if (!u) return { ok:false, error:'NOT_FOUND' };
    if (u.password !== password) return { ok:false, error:'BAD_PASSWORD' };
    return { ok:true, user: { character, points: Number(u.points||0) } };
  }

  async getQuestion(key) { return this.load().questions[key] || null; }
  async setQuestion(key, q) {
    const s = this.load();
    s.questions[key] = q;
    this.save(s);
  }

  async answer({ character, key, isCorrect }) {
    const s = this.load();
    const u = s.users[character];
    if (!u) return { ok:false, error:'NOT_FOUND' };
    if (u.lastAnsweredKey === key) return { ok:false, error:'ALREADY_ANSWERED' };
    u.lastAnsweredKey = key;
    if (isCorrect) u.points = Number(u.points||0) + 1;
    this.save(s);
    return { ok:true, points: Number(u.points||0) };
  }

  async hasAnswered(character, key) {
    const s = this.load();
    return s.users[character]?.lastAnsweredKey === key;
  }
}

class NeonStorage {
  constructor(url) {
    const { neon } = require('@neondatabase/serverless');
    this.sql = neon(url);
  }

  async init() {
    await this.sql`
      CREATE TABLE IF NOT EXISTS quiz_users (
        character TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        last_answered_key TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        question_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  async bootstrap() {
    const rows = await this.sql`SELECT character, points FROM quiz_users ORDER BY points DESC, character ASC LIMIT 20`;
    const takenRows = await this.sql`SELECT character FROM quiz_users`;
    return {
      characters: CHARACTERS,
      taken: takenRows.map(r=>r.character),
      leaderboard: rows.map(r=>({ character:r.character, points:Number(r.points||0) }))
    };
  }

  async register({ character, password }) {
    if (!CHARACTERS.includes(character)) return { ok:false, error:'UNKNOWN_CHARACTER' };
    try {
      await this.sql`INSERT INTO quiz_users (character, password) VALUES (${character}, ${password})`;
      return { ok:true };
    } catch (e) {
      if (e?.code === '23505') return { ok:false, error:'CHARACTER_TAKEN' };
      throw e;
    }
  }

  async login({ character, password }) {
    const rows = await this.sql`SELECT character, password, points FROM quiz_users WHERE character = ${character} LIMIT 1`;
    if (!rows.length) return { ok:false, error:'NOT_FOUND' };
    const u = rows[0];
    if (u.password !== password) return { ok:false, error:'BAD_PASSWORD' };
    return { ok:true, user:{ character:u.character, points:Number(u.points||0) } };
  }

  async getQuestion(key) {
    const rows = await this.sql`SELECT payload FROM quiz_questions WHERE question_key = ${key} LIMIT 1`;
    return rows.length ? rows[0].payload : null;
  }

  async setQuestion(key, q) {
    await this.sql`INSERT INTO quiz_questions (question_key, payload) VALUES (${key}, ${JSON.stringify(q)}) ON CONFLICT (question_key) DO NOTHING`;
  }

  async answer({ character, key, isCorrect }) {
    const rows = await this.sql`SELECT last_answered_key, points FROM quiz_users WHERE character = ${character} LIMIT 1`;
    if (!rows.length) return { ok:false, error:'NOT_FOUND' };
    const u = rows[0];
    if (u.last_answered_key === key) return { ok:false, error:'ALREADY_ANSWERED' };
    const newPoints = Number(u.points||0) + (isCorrect ? 1 : 0);
    await this.sql`UPDATE quiz_users SET last_answered_key = ${key}, points = ${newPoints} WHERE character = ${character}`;
    return { ok:true, points:newPoints };
  }

  async hasAnswered(character, key) {
    const rows = await this.sql`SELECT last_answered_key FROM quiz_users WHERE character = ${character} LIMIT 1`;
    return rows.length ? rows[0].last_answered_key === key : false;
  }
}

function createStorage(statePath) {
  const db = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.QUIZ_DATABASE_URL || process.env.QUIZ_POSTGRES_URL;
  if (db) return new NeonStorage(db);
  return new FileStorage(statePath);
}

module.exports = { createStorage, FileStorage, CHARACTERS };
