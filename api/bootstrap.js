const { storage, ensureInit } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'GET') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  await ensureInit();
  return res.json({ ok:true, ...(await storage.bootstrap()) });
};
