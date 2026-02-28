const { storage, getDailyQuestion } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'GET') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  try {
    const url = new URL(req.url, 'http://localhost');
    const character = String(url.searchParams.get('character') || '').trim();
    const q = await getDailyQuestion();
    const alreadyAnswered = character ? storage.hasAnswered(character, q.key) : false;
    return res.json({ ok:true, question:{ key:q.key, prompt:q.prompt, options:q.options }, alreadyAnswered });
  } catch { res.statusCode=500; return res.json({ok:false,error:'Konnte Tagesfrage nicht laden.'}); }
};
