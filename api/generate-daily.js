const { getDailyRound } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode=405;
    return res.json({ok:false,error:'Method not allowed'});
  }
  try {
    const q = await getDailyRound();
    return res.json({ ok:true, key:q.key, totalQuestions: q.questions.length });
  } catch {
    res.statusCode=500;
    return res.json({ ok:false, error:'Could not generate daily round' });
  }
};
