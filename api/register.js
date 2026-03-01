const { storage, ensureInit, mapErr, body } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'POST') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  try {
    await ensureInit();
    const p = await body(req);
    const character = String(p.character||'').trim();
    const r = await storage.register({ character });
    if (!r.ok){ const [c,m]=mapErr(r.error); res.statusCode=c; return res.json({ok:false,error:m}); }
    return res.json({ok:true});
  } catch { res.statusCode=400; return res.json({ok:false,error:'Invalid request.'}); }
};
