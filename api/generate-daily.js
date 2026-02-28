const { getDailyQuestion } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode=405;
    return res.json({ok:false,error:'Method not allowed'});
  }
  try {
    const q = await getDailyQuestion();
    return res.json({ ok:true, key:q.key, sourceTitle:q.sourceTitle });
  } catch {
    res.statusCode=500;
    return res.json({ ok:false, error:'Could not generate daily question' });
  }
};
