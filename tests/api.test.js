const test = require('node:test');
const assert = require('node:assert/strict');

const { FileStorage } = require('../storage');

test('register/login and 3-question scoring basics', async () => {
  const s = new FileStorage('/tmp/quiz-test.json');
  s.save({ users: {}, questions: {} });

  const r = await s.register({ character: 'Arschwasser 3' });
  assert.equal(r.ok, true);

  const dup = await s.register({ character: 'Arschwasser 3' });
  assert.equal(dup.ok, false);

  const login = await s.login({ character: 'Arschwasser 3' });
  assert.equal(login.ok, true);

  await s.setQuestion('2026-02-28', { questions:[
    { prompt:'q1', options:['a','b','c','d'], correctIndex:0 },
    { prompt:'q2', options:['a','b','c','d'], correctIndex:0 },
    { prompt:'q3', options:['a','b','c','d'], correctIndex:0 }
  ] });

  const a1 = await s.answer({ character:'Arschwasser 3', key:'2026-02-28', questionIndex:0, isCorrect:true });
  assert.equal(a1.ok, true);
  assert.equal(a1.points, 1);
  assert.equal(a1.answeredCount, 1);

  const a2 = await s.answer({ character:'Arschwasser 3', key:'2026-02-28', questionIndex:1, isCorrect:false });
  assert.equal(a2.ok, true);
  assert.equal(a2.points, 1);
  assert.equal(a2.answeredCount, 2);

  const again = await s.answer({ character:'Arschwasser 3', key:'2026-02-28', questionIndex:1, isCorrect:true });
  assert.equal(again.ok, false);
});
