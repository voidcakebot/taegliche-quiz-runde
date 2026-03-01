const { storage, ensureInit, getDailyRound } = require('./_shared');

module.exports = async function(req,res){
  if (req.method !== 'GET') { res.statusCode=405; return res.json({ok:false,error:'Method not allowed'}); }
  try {
    await ensureInit();
    const url = new URL(req.url, 'http://localhost');
    const character = String(url.searchParams.get('character') || '').trim();
    const requestedIndex = Number(url.searchParams.get('questionIndex') || 0);
    const round = await getDailyRound();

    let progress = { answered:[false,false,false], answeredCount:0 };
    if (character) progress = await storage.getProgress(character, round.key);

    const firstOpen = progress.answered.findIndex((v)=>!v);
    const nextIndex = firstOpen === -1 ? 2 : firstOpen;
    const questionIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex <= 2
      ? Math.min(requestedIndex, nextIndex)
      : nextIndex;

    const q = round.questions[questionIndex];
    return res.json({
      ok:true,
      key: round.key,
      questionIndex,
      totalQuestions: 3,
      progress,
      finished: progress.answeredCount >= 3,
      question: { prompt:q.prompt, options:q.options }
    });
  } catch {
    res.statusCode=500;
    return res.json({ok:false,error:'Could not load daily questions.'});
  }
};
