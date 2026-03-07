const { storage, ensureInit, body, mapErr } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'POST') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  try {
    await ensureInit();
    const p = await body(req);
    if (String(p.confirm || '') !== 'BONUS_POINT') {
      res.statusCode = 400;
      return res.json({ ok:false, error:'Missing confirm token.' });
    }
    const character = String(p.character || '').trim();
    const r = await storage.addBonusPoint(character);
    if (!r.ok) { const [c,m]=mapErr(r.error); res.statusCode=c; return res.json({ok:false,error:m}); }
    return res.json({ ok:true, character, points:r.points });
  } catch {
    res.statusCode=500;
    return res.json({ ok:false, error:'Bonus failed' });
  }
};
