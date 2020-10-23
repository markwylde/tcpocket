const fs = require('fs');
const test = require('./utils/asyncTape');

const { createServer, createClient } = require('../');

function closeSockets (...args) {
  args.forEach(arg => arg.close());
}

test('basic two way server connection works', async t => {
  t.plan(3);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    t.deepEqual(request.data, { a: 1 }, 'server received a testCmd');
    response.send({ b: 2 });
  });

  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  client.on('connect', () => {
    t.pass('connect was successful');
  });
  const response = await client.send({ a: 1 });

  t.deepEqual(response, { b: 2 }, 'client received a testResp');
  closeSockets(server, client);
});

test('basic two way server connection works with certs', async t => {
  t.plan(3);

  const serverTls = {
    key: fs.readFileSync('./certs/localhost.1.privkey.pem'),
    cert: fs.readFileSync('./certs/localhost.1.cert.pem'),
    ca: [fs.readFileSync('./certs/ca.cert.pem')],
    requestCert: true
  };
  const clientTls = {
    key: fs.readFileSync('./certs/localhost.2.privkey.pem'),
    cert: fs.readFileSync('./certs/localhost.2.cert.pem'),
    ca: [fs.readFileSync('./certs/ca.cert.pem')]
  };

  const server = createServer({ port: 8000, tls: serverTls }, function (request, response) {
    t.deepEqual(request.data, { a: 1 }, 'server received a testCmd');

    response.send({ b: 2 });
  });
  server.open();

  const client = createClient({ host: 'localhost', port: 8000, tls: clientTls });
  client.on('secureConnect', () => {
    t.pass('secureConnect was successful');
  });

  const response = await client.send({ a: 1 });

  t.deepEqual(response, { b: 2 }, 'client received a testResp');
  closeSockets(server, client);
});

test('certs - wrong client certs fail', async t => {
  t.plan(1);

  const serverTls = {
    key: fs.readFileSync('./certs/localhost.1.privkey.pem'),
    cert: fs.readFileSync('./certs/localhost.1.cert.pem'),
    ca: [fs.readFileSync('./certs/ca.cert.pem')],
    requestCert: true
  };
  const clientTls = {
    key: fs.readFileSync('./certs/localhost.wrong.privkey.pem'),
    cert: fs.readFileSync('./certs/localhost.wrong.cert.pem'),
    ca: [fs.readFileSync('./certs/ca.wrong.cert.pem')]
  };

  const server = createServer({ port: 8000, tls: serverTls }, function (request, response) {});
  server.open();

  const client = createClient({ host: 'localhost', port: 8000, tls: clientTls });

  client.on('error', error => {
    t.equal(error.code, 'CERT_SIGNATURE_FAILURE');
    closeSockets(server);
  });

  client.on('secureConnect', () => {
    t.fail('secureConnect should not have been called');
  });
});

test('client can ask and get multiple responses', async t => {
  t.plan(1);

  const server = createServer({ port: 8000 }, function (request, response) {
    response.send({ ar: request.data.a });
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  const responses = await Promise.all([
    client.send({ a: 1 }),
    client.send({ a: 2 }),
    client.send({ a: 3 }),
    client.send({ a: 4 }),
    client.send({ a: 10 })
  ]);

  t.deepEqual(responses, [
    { ar: 1 },
    { ar: 2 },
    { ar: 3 },
    { ar: 4 },
    { ar: 10 }
  ], 'server received all responses');

  closeSockets(server, client);
});
