const http = require('http');
const { handler } = require('./app');

const port = Number(process.env.PORT || 4174);
http.createServer(handler).listen(port, '0.0.0.0', () => {
  console.log(`taegliche-quiz-runde listening on ${port}`);
});
