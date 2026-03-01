const { storage, ensureInit, body } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'POST') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  try {
    await ensureInit();
    const p = await body(req);
    if (String(p.confirm || '') !== 'RESET_USERS') {
      res.statusCode = 400;
      return res.json({ ok:false, error:'Missing confirm token.' });
    }
    await storage.clearUsers();
    return res.json({ ok:true });
  } catch {
    res.statusCode=500;
    return res.json({ ok:false, error:'Reset failed' });
  }
};
