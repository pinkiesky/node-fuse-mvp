const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 404;
    res.end();

    return;
  }

  let chunks = [];
  let size = 0;

  req.on('data', (chunk) => {
    chunks.push(chunk);
    size += chunk.length;
  });

  req.on('end', () => {
    console.log('got all data: ', {
      size,
      content: Buffer.concat(chunks).toString(),
    });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ size }));
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
