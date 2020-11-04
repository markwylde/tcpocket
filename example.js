const tcpocket = require('./');

async function main () {
  const server = tcpocket.createServer({ port: 8000 }, function (request, response) {
    console.log(request.data); // === { a: 1 }
    response.send({ b: 2 });
  });
  server.open();

  const client = tcpocket.createClient({ host: '0.0.0.0', port: 8000 });
  const response = await client.send({ a: 1 });
  console.log(response); // === { b: 2}
}

main();
