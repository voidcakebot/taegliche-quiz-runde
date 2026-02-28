const { storage, ensureInit, mapErr, getDailyQuestion, body } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'POST') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  try {
    await ensureInit();
    const p = await body(req);
    const character = String(p.character||'').trim();
    const password = String(p.password||'').trim();
    const choiceIndex = Number(p.choiceIndex);
    const login = await storage.login({ character, password });
    if (!login.ok){ const [c,m]=mapErr(login.error); res.statusCode=c; return res.json({ok:false,error:m}); }
    const q = await getDailyQuestion();
    const isCorrect = choiceIndex === Number(q.correctIndex);
    const r = await storage.answer({ character, key:q.key, isCorrect });
    if (!r.ok){ const [c,m]=mapErr(r.error); res.statusCode=c; return res.json({ok:false,error:m}); }
    return res.json({ ok:true, isCorrect, correctIndex:q.correctIndex, points:r.points });
  } catch { res.statusCode=400; return res.json({ok:false,error:'Ungültige Anfrage.'}); }
};
