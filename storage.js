const fs = require('fs');

const REMOVED_CHARACTERS = ['Benis der Große', 'Schwuler Bóbr', 'Transkrieger'];

const CHARACTERS = [
  'Arschwasser 3',
  'Möslefrau',
  'Durchfallman'
];

function berlinMonthKeyNow() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit'
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}`;
}

function normalizeUser(u = {}) {
  return {
    password: String(u.password || ''),
    points: Number(u.points || 0),
    pointsByMonth: typeof u.pointsByMonth === 'object' && u.pointsByMonth ? u.pointsByMonth : {},
    createdAt: u.createdAt || new Date().toISOString(),
    answeredByDay: typeof u.answeredByDay === 'object' && u.answeredByDay ? u.answeredByDay : {},
    // legacy fields kept for compatibility
    lastAnsweredKey: u.lastAnsweredKey || null
  };
}

class FileStorage {
  constructor(path) { this.path = path; }
  load() {
    if (!fs.existsSync(this.path)) return { users: {}, questions: {} };
    try {
      const d = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      d.users ||= {}; d.questions ||= {};
      for (const removed of REMOVED_CHARACTERS) delete d.users[removed];
      for (const k of Object.keys(d.users)) d.users[k] = normalizeUser(d.users[k]);
      return d;
    } catch { return { users: {}, questions: {} }; }
  }
  save(data) { fs.writeFileSync(this.path, JSON.stringify(data, null, 2)); }

  async init() {}

  async bootstrap() {
    const s = this.load();
    const taken = Object.keys(s.users);
    const monthKey = berlinMonthKeyNow();
    const leaderboard = Object.entries(s.users)
      .map(([character, u]) => ({ character, points: Number(u.points || 0) }))
      .sort((a,b)=>b.points-a.points)
      .slice(0, 20);
    const monthlyLeaderboard = Object.entries(s.users)
      .map(([character, u]) => ({ character, points: Number((u.pointsByMonth || {})[monthKey] || 0) }))
      .sort((a,b)=>b.points-a.points)
      .slice(0, 20);
    return { characters: CHARACTERS, taken, leaderboard, monthlyLeaderboard, monthKey };
  }

  async register({ character, password }) {
    const s = this.load();
    if (!CHARACTERS.includes(character)) return { ok:false, error:'UNKNOWN_CHARACTER' };
    if (s.users[character]) return { ok:false, error:'CHARACTER_TAKEN' };
    s.users[character] = normalizeUser({ password, createdAt: new Date().toISOString() });
    this.save(s);
    return { ok:true };
  }

  async login({ character, password }) {
    const s = this.load();
    const u = s.users[character];
    if (!u) return { ok:false, error:'NOT_FOUND' };
    if (String(u.password || '') !== String(password || '')) return { ok:false, error:'BAD_PASSWORD' };
    return { ok:true, user: { character, points: Number(u.points||0) } };
  }

  async getQuestion(key) { return this.load().questions[key] || null; }
  async setQuestion(key, q) {
    const s = this.load();
    s.questions[key] = q;
    this.save(s);
  }

  async answer({ character, key, questionIndex, isCorrect }) {
    const s = this.load();
    const u = s.users[character];
    if (!u) return { ok:false, error:'NOT_FOUND' };
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 2) return { ok:false, error:'BAD_QUESTION_INDEX' };

    u.answeredByDay ||= {};
    const day = u.answeredByDay[key] || [false, false, false];
    if (day[questionIndex]) return { ok:false, error:'ALREADY_ANSWERED' };

    day[questionIndex] = true;
    u.answeredByDay[key] = day;

    if (isCorrect) {
      u.points = Number(u.points||0) + 1;
      const monthKey = String(key || '').slice(0,7);
      u.pointsByMonth ||= {};
      u.pointsByMonth[monthKey] = Number(u.pointsByMonth[monthKey] || 0) + 1;
    }
    s.users[character] = normalizeUser(u);
    this.save(s);

    return {
      ok:true,
      points: Number(u.points||0),
      answered: day,
      answeredCount: day.filter(Boolean).length
    };
  }

  async hasAnswered(character, key, questionIndex) {
    const s = this.load();
    const day = s.users[character]?.answeredByDay?.[key] || [false, false, false];
    if (Number.isInteger(questionIndex)) return Boolean(day[questionIndex]);
    return day.every(Boolean);
  }

  async getProgress(character, key) {
    const s = this.load();
    const day = s.users[character]?.answeredByDay?.[key] || [false, false, false];
    return { answered: day, answeredCount: day.filter(Boolean).length };
  }

  async clearUsers() {
    const s = this.load();
    s.users = {};
    this.save(s);
    return { ok: true };
  }

  async clearQuestions() {
    const s = this.load();
    s.questions = {};
    this.save(s);
    return { ok: true };
  }

  async upsertUserState({ character, password, points, answeredByDay, pointsByMonth }) {
    const s = this.load();
    if (!CHARACTERS.includes(character)) return { ok:false, error:'UNKNOWN_CHARACTER' };
    const existing = normalizeUser(s.users[character] || {});
    s.users[character] = normalizeUser({
      ...existing,
      password: String(password ?? existing.password ?? ''),
      points: Number.isFinite(Number(points)) ? Number(points) : Number(existing.points || 0),
      pointsByMonth: (pointsByMonth && typeof pointsByMonth === 'object') ? pointsByMonth : (existing.pointsByMonth || {}),
      answeredByDay: (answeredByDay && typeof answeredByDay === 'object') ? answeredByDay : (existing.answeredByDay || {})
    });
    this.save(s);
    return { ok:true };
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
        password TEXT NOT NULL DEFAULT '',
        points INTEGER NOT NULL DEFAULT 0,
        points_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
        answered_by_day JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await this.sql`ALTER TABLE quiz_users ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT ''`;
    await this.sql`ALTER TABLE quiz_users ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0`;
    await this.sql`ALTER TABLE quiz_users ADD COLUMN IF NOT EXISTS points_by_month JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await this.sql`ALTER TABLE quiz_users ADD COLUMN IF NOT EXISTS answered_by_day JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await this.sql`ALTER TABLE quiz_users DROP COLUMN IF EXISTS last_answered_key`;
    await this.sql`DELETE FROM quiz_users WHERE character = ANY(${REMOVED_CHARACTERS})`;

    await this.sql`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        question_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  async bootstrap() {
    const rows = await this.sql`SELECT character, points, points_by_month FROM quiz_users ORDER BY points DESC, character ASC LIMIT 20`;
    const takenRows = await this.sql`SELECT character FROM quiz_users`;
    const monthKey = berlinMonthKeyNow();
    const monthlyLeaderboard = rows
      .map(r=>({ character:r.character, points:Number((r.points_by_month || {})[monthKey] || 0) }))
      .sort((a,b)=>b.points-a.points);
    return {
      characters: CHARACTERS,
      taken: takenRows.map(r=>r.character),
      leaderboard: rows.map(r=>({ character:r.character, points:Number(r.points||0) })),
      monthlyLeaderboard,
      monthKey
    };
  }

  async register({ character, password }) {
    if (!CHARACTERS.includes(character)) return { ok:false, error:'UNKNOWN_CHARACTER' };
    try {
      await this.sql`INSERT INTO quiz_users (character, password) VALUES (${character}, ${String(password || '')})`;
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
    if (String(u.password || '') !== String(password || '')) return { ok:false, error:'BAD_PASSWORD' };
    return { ok:true, user:{ character:u.character, points:Number(u.points||0) } };
  }

  async getQuestion(key) {
    const rows = await this.sql`SELECT payload FROM quiz_questions WHERE question_key = ${key} LIMIT 1`;
    return rows.length ? rows[0].payload : null;
  }

  async setQuestion(key, q) {
    await this.sql`INSERT INTO quiz_questions (question_key, payload) VALUES (${key}, ${JSON.stringify(q)}) ON CONFLICT (question_key) DO NOTHING`;
  }

  async answer({ character, key, questionIndex, isCorrect }) {
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 2) return { ok:false, error:'BAD_QUESTION_INDEX' };

    const rows = await this.sql`SELECT points, points_by_month, answered_by_day FROM quiz_users WHERE character = ${character} LIMIT 1`;
    if (!rows.length) return { ok:false, error:'NOT_FOUND' };

    const u = rows[0];
    const answeredByDay = (u.answered_by_day && typeof u.answered_by_day === 'object') ? u.answered_by_day : {};
    const day = Array.isArray(answeredByDay[key]) ? answeredByDay[key] : [false, false, false];

    if (day[questionIndex]) return { ok:false, error:'ALREADY_ANSWERED' };

    day[questionIndex] = true;
    answeredByDay[key] = day;
    const newPoints = Number(u.points||0) + (isCorrect ? 1 : 0);
    const pointsByMonth = (u.points_by_month && typeof u.points_by_month === 'object') ? u.points_by_month : {};
    if (isCorrect) {
      const monthKey = String(key || '').slice(0,7);
      pointsByMonth[monthKey] = Number(pointsByMonth[monthKey] || 0) + 1;
    }

    await this.sql`UPDATE quiz_users SET points = ${newPoints}, points_by_month = ${JSON.stringify(pointsByMonth)}, answered_by_day = ${JSON.stringify(answeredByDay)} WHERE character = ${character}`;

    return {
      ok:true,
      points:newPoints,
      answered: day,
      answeredCount: day.filter(Boolean).length
    };
  }

  async hasAnswered(character, key, questionIndex) {
    const rows = await this.sql`SELECT answered_by_day FROM quiz_users WHERE character = ${character} LIMIT 1`;
    if (!rows.length) return false;
    const byDay = rows[0].answered_by_day || {};
    const day = Array.isArray(byDay[key]) ? byDay[key] : [false, false, false];
    if (Number.isInteger(questionIndex)) return Boolean(day[questionIndex]);
    return day.every(Boolean);
  }

  async getProgress(character, key) {
    const rows = await this.sql`SELECT answered_by_day FROM quiz_users WHERE character = ${character} LIMIT 1`;
    const byDay = rows.length ? (rows[0].answered_by_day || {}) : {};
    const day = Array.isArray(byDay[key]) ? byDay[key] : [false, false, false];
    return { answered: day, answeredCount: day.filter(Boolean).length };
  }

  async clearUsers() {
    await this.sql`DELETE FROM quiz_users`;
    return { ok: true };
  }

  async clearQuestions() {
    await this.sql`DELETE FROM quiz_questions`;
    return { ok: true };
  }

  async upsertUserState({ character, password, points, answeredByDay, pointsByMonth }) {
    if (!CHARACTERS.includes(character)) return { ok:false, error:'UNKNOWN_CHARACTER' };
    await this.sql`
      INSERT INTO quiz_users (character, password, points, points_by_month, answered_by_day)
      VALUES (${character}, ${String(password || '')}, ${Number(points || 0)}, ${JSON.stringify(pointsByMonth || {})}, ${JSON.stringify(answeredByDay || {})})
      ON CONFLICT (character)
      DO UPDATE SET
        password = EXCLUDED.password,
        points = EXCLUDED.points,
        points_by_month = EXCLUDED.points_by_month,
        answered_by_day = EXCLUDED.answered_by_day
    `;
    return { ok:true };
  }
}


function createStorage(statePath) {
  const db = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.QUIZ_DATABASE_URL || process.env.QUIZ_POSTGRES_URL;
  if (db) return new NeonStorage(db);
  return new FileStorage(statePath);
}

module.exports = { createStorage, FileStorage, CHARACTERS };
