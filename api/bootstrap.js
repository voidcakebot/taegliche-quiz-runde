const { storage } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'GET') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  return res.json({ ok:true, ...storage.bootstrap() });
};
