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

  bootstrap() {
    const s = this.load();
    const taken = Object.keys(s.users);
    const leaderboard = Object.entries(s.users)
      .map(([character, u]) => ({ character, points: Number(u.points || 0) }))
      .sort((a,b)=>b.points-a.points)
      .slice(0, 20);
    return { characters: CHARACTERS, taken, leaderboard };
  }

  register({ character, password }) {
    const s = this.load();
    if (!CHARACTERS.includes(character)) return { ok:false, error:'UNKNOWN_CHARACTER' };
    if (s.users[character]) return { ok:false, error:'CHARACTER_TAKEN' };
    s.users[character] = { password, points: 0, createdAt: new Date().toISOString(), lastAnsweredKey: null };
    this.save(s);
    return { ok:true };
  }

  login({ character, password }) {
    const s = this.load();
    const u = s.users[character];
    if (!u) return { ok:false, error:'NOT_FOUND' };
    if (u.password !== password) return { ok:false, error:'BAD_PASSWORD' };
    return { ok:true, user: { character, points: Number(u.points||0) } };
  }

  getQuestion(key) { return this.load().questions[key] || null; }
  setQuestion(key, q) {
    const s = this.load();
    s.questions[key] = q;
    this.save(s);
  }

  answer({ character, key, isCorrect }) {
    const s = this.load();
    const u = s.users[character];
    if (!u) return { ok:false, error:'NOT_FOUND' };
    if (u.lastAnsweredKey === key) return { ok:false, error:'ALREADY_ANSWERED' };
    u.lastAnsweredKey = key;
    if (isCorrect) u.points = Number(u.points||0) + 1;
    this.save(s);
    return { ok:true, points: Number(u.points||0) };
  }

  hasAnswered(character, key) {
    const s = this.load();
    return s.users[character]?.lastAnsweredKey === key;
  }
}

module.exports = { FileStorage, CHARACTERS };
