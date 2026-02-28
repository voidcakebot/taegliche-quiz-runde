const test = require('node:test');
const assert = require('node:assert/strict');

const { FileStorage } = require('../storage');

test('register/login and scoring basics', () => {
  const s = new FileStorage('/tmp/quiz-test.json');
  s.save({ users: {}, questions: {} });

  const r = s.register({ character: 'Sir Nebelzahn', password: '1234' });
  assert.equal(r.ok, true);

  const dup = s.register({ character: 'Sir Nebelzahn', password: '1234' });
  assert.equal(dup.ok, false);

  const login = s.login({ character: 'Sir Nebelzahn', password: '1234' });
  assert.equal(login.ok, true);

  s.setQuestion('2026-02-28', { prompt:'x', options:['a','b','c','d'], correctIndex:0 });
  const a = s.answer({ character:'Sir Nebelzahn', key:'2026-02-28', isCorrect:true });
  assert.equal(a.ok, true);
  assert.equal(a.points, 1);

  const again = s.answer({ character:'Sir Nebelzahn', key:'2026-02-28', isCorrect:true });
  assert.equal(again.ok, false);
});
