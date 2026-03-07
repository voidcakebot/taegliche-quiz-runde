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

  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit' });
  const parts = Object.fromEntries(dtf.formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysRemaining = Math.max(0, lastDay - d);
  const monthEndsAt = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

  return res.json({ ok:true, ...base, todayKey, completionByCharacter, month:{ today:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, monthEndsAt, daysRemaining } });
};
