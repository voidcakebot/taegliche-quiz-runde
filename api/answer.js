const { storage, ensureInit, mapErr, getDailyRound, body } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'POST') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  try {
    await ensureInit();
    const p = await body(req);
    const character = String(p.character||'').trim();
    const password = String(p.password||'').trim();
    const questionIndex = Number(p.questionIndex);
    const choiceIndex = Number(p.choiceIndex);
    const timedOut = Boolean(p.timedOut);

    const login = await storage.login({ character, password });
    if (!login.ok){ const [c,m]=mapErr(login.error); res.statusCode=c; return res.json({ok:false,error:m}); }

    const round = await getDailyRound();
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 2) {
      res.statusCode = 400;
      return res.json({ ok:false, error:'Invalid question index.' });
    }

    const q = round.questions[questionIndex];
    const isCorrect = !timedOut && choiceIndex === Number(q.correctIndex);

    const r = await storage.answer({ character, key: round.key, questionIndex, isCorrect });
    if (!r.ok){ const [c,m]=mapErr(r.error); res.statusCode=c; return res.json({ok:false,error:m}); }

    const roundFinished = r.answeredCount >= 3;
    return res.json({
      ok:true,
      isCorrect,
      timedOut,
      correctIndex:q.correctIndex,
      points:r.points,
      answered:r.answered,
      answeredCount:r.answeredCount,
      roundFinished
    });
  } catch {
    res.statusCode=400;
    return res.json({ok:false,error:'Invalid request.'});
  }
};
