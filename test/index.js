const fs = require('fs');
const assert = require('assert');

const test = require('basictap');

const mapTimes = (times, fn) => Array(times).fill().map((_, index) => fn(index));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const { createServer, createClient } = require('../');

function closeSockets (...args) {
  return Promise.all(args.map(arg => arg.close()));
}

test('basic two way server connection works', async t => {
  t.plan(3);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    t.deepEqual(request.data, { a: 1 }, 'server received a testCmd');
    response.reply({ b: 2 });
  });

  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  client.on('connect', () => {
    t.pass('connect was successful');
  });
  const response = await client.send({ a: 1 });

  await closeSockets(server, client);

  t.deepEqual(response, { b: 2 }, 'client received a testResp');
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

  const server = createServer({ port: 8000, ...serverTls }, function (request, response) {
    t.deepEqual(request.data, { a: 1 }, 'server received a testCmd');

    response.reply({ b: 2 });
  });
  server.open();

  const client = createClient({ host: 'localhost', port: 8000, ...clientTls });
  client.on('secureConnect', () => {
    t.pass('secureConnect was successful');
  });

  const response = await client.send({ a: 1 });

  await closeSockets(server, client);

  t.deepEqual(response, { b: 2 }, 'client received a testResp');
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

  const server = createServer({ port: 8000, ...serverTls }, function (request, response) {});
  server.open();

  const client = createClient({ host: 'localhost', port: 8000, ...clientTls });

  client.once('error', async error => {
    await closeSockets(client, server);
    t.equal(error.code, 'CERT_SIGNATURE_FAILURE');
  });

  client.on('secureConnect', () => {
    t.fail('secureConnect should not have been called');
  });
});

test('client can ask and get multiple responses', async t => {
  t.plan(1);

  const server = createServer({ port: 8000 }, function (request, response) {
    response.reply({ ar: request.data.a });
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

  await closeSockets(server, client);

  t.deepEqual(responses, [
    { ar: 1 },
    { ar: 2 },
    { ar: 3 },
    { ar: 4 },
    { ar: 10 }
  ], 'server received all responses');
});

test('client connects when server starts after', async t => {
  t.plan(1);

  const client = createClient({ host: '0.0.0.0', port: 8000, reconnectDelay: 50 });

  await sleep(100);

  const server = createServer({ port: 8000 }, function (request, response) {
    response.reply({ ar: request.data.a });
  });
  server.open();

  await sleep(100);

  const response1 = await client.send({ a: 1 });

  await closeSockets(server, client);

  t.deepEqual(response1, { ar: 1 });
});

test('client sends message when server starts after', async t => {
  t.plan(1);

  const client = createClient({ host: '0.0.0.0', port: 8000, reconnectDelay: 50 });
  client.send({ a: 1 }).then(async response1 => {
    await closeSockets(server, client);

    t.deepEqual(response1, { ar: 1 });
  });

  await sleep(100);

  const server = createServer({ port: 8000 }, function (request, response) {
    response.reply({ ar: request.data.a });
  });
  server.open();
});

test('client sends error when server disconnects mid message', async t => {
  t.plan(1);

  const server = createServer({ port: 8000 }, function (request, response) {
    response.reply({ ar: request.data.a });
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000, reconnectDelay: 50 });
  server.close();

  client.send({ a: 1 }, false).catch(async error => {
    await closeSockets(server, client);

    t.equal(error.message, 'shit');
  });
});

test('client errors when server never starts', async t => {
  t.plan(1);

  const client = createClient({ host: '0.0.0.0', port: 8000, reconnectDelay: 50 });
  client.send({ a: 1 }).catch(error => {
    t.equal(error.message, 'tcpocket: client stopped');
  });
  client.close();
});

test('client reconnects when server goes offline and comes back online', async t => {
  t.plan(2);

  const server = createServer({ port: 8000 }, function (request, response) {
    response.reply({ ar: request.data.a });
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000, reconnectDelay: 100 });
  const response1 = await client.send({ a: 1 });

  server.close();
  server.open();
  await sleep(200);

  const response2 = await client.send({ a: 1 });

  await closeSockets(server, client);

  t.deepEqual(response1, { ar: 1 });
  t.deepEqual(response2, { ar: 1 });
});

test('one way communication', async t => {
  t.plan(2);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    response.reply({ status: 'success' });
    response.send({ another: 'message' });
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  client.on('message', async (data) => {
    await closeSockets(server, client);

    t.equal(data.another, 'message');
  });
  const reply = await client.send({ command: 'something' });
  t.deepEqual(reply, { status: 'success' });
});

test('stress test and timings', async t => {
  t.plan(2);

  const startTime = Date.now();
  let succeeded = 0;
  for (let serverIndex = 0; serverIndex < 20; serverIndex++) {
    const server = createServer({ port: 8000 + serverIndex }, function (request, response) {
      response.reply({ ar: request.data.a });
    });
    server.open();

    const clientsPromises = mapTimes(50, async clientIndex => {
      const client = createClient({ host: '0.0.0.0', port: 8000 + serverIndex });
      const responses = await Promise.all([
        client.send({ a: 1 }),
        client.send({ a: 2 }),
        client.send({ a: 3 }),
        client.send({ a: 4 }),
        client.send({ a: 10 })
      ]);

      assert.deepEqual(responses, [
        { ar: 1 },
        { ar: 2 },
        { ar: 3 },
        { ar: 4 },
        { ar: 10 }
      ]);
      succeeded = succeeded + 1;

      return client;
    });

    const clients = await Promise.all(clientsPromises);

    await closeSockets(server, ...clients);
  }

  const timeTaken = Date.now() - startTime;

  t.equal(succeeded, 1000);
  t.ok(timeTaken < 2000, 'should take less than 2 seconds (' + timeTaken + 'ms)');
});
