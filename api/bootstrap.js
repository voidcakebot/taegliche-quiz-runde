const { storage, ensureInit } = require('./_shared');
const { berlinKeyNow } = require('../wiki');

module.exports = async function(req,res){
  if (req.method !== 'GET') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  await ensureInit();

  const base = await storage.bootstrap();
  const todayKey = berlinKeyNow();
  const completionByCharacter = {};

  await Promise.all(
    (base.taken || []).map(async (character) => {
      const progress = await storage.getProgress(character, todayKey);
      completionByCharacter[character] = Number(progress?.answeredCount || 0) >= 3;
    })
  );

  return res.json({ ok:true, ...base, todayKey, completionByCharacter });
};
