const fs = require('fs');
const assert = require('assert');

const test = require('basictap');

require('./miniler.js');

const mapTimes = (times, fn) => Array(times).fill().map((_, index) => fn(index));

const { createServer, createClient } = require('../');

function closeSockets (...args) {
  return Promise.all(args.map(arg => arg.close()));
}

test('basic two way server connection works', async t => {
  t.plan(5);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    t.equal(request.command, 12, 'server received the correct command');
    t.equal(request.data.toString(), 'something', 'server received the correct command');
    response.reply(24, Buffer.from('something else'));
  });

  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  client.on('connect', () => {
    t.pass('connect was successful');
  });
  await client.waitUntilConnected();

  const response = await client.send(12, Buffer.from('something'));

  await closeSockets(server, client);

  t.deepEqual(response.command, 24, 'client received correct command');
  t.deepEqual(response.data.toString(), 'something else', 'client received correct data');
});

test('client - send data as string', async t => {
  t.plan(3);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    t.equal(request.command, 12, 'server received the correct command');
    t.equal(request.data.toString(), '"something"', 'server received the correct command');
    response.reply(2);
  });

  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  client.on('connect', () => {
    t.pass('connect was successful');
  });
  await client.waitUntilConnected();
  await client.send(12, 'something');
  await closeSockets(server, client);
});

test('client - send data as object', async t => {
  t.plan(3);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    t.equal(request.command, 12, 'server received the correct command');
    t.equal(request.data.toString(), '{"a":"something"}', 'server received the correct command');
    response.reply(2);
  });

  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  client.on('connect', () => {
    t.pass('connect was successful');
  });
  await client.waitUntilConnected();
  await client.send(12, { a: 'something' });
  await closeSockets(server, client);
});

test('client - send data as array', async t => {
  t.plan(3);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    t.equal(request.command, 12, 'server received the correct command');
    t.equal(request.data.toString(), '["something"]', 'server received the correct command');
    response.reply(2);
  });

  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  client.on('connect', () => {
    t.pass('connect was successful');
  });
  await client.waitUntilConnected();
  await client.send(12, ['something']);
  await closeSockets(server, client);
});

test('basic two way server connection works with certs', async t => {
  t.plan(5);

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
    t.equal(request.command, 12, 'server received the correct command');
    t.equal(request.data.toString(), 'something', 'server received the correct command');
    response.reply(24, Buffer.from('something else'));
  });
  server.open();

  const client = createClient({ host: 'localhost', port: 8000, ...clientTls });
  client.on('secureConnect', () => {
    t.pass('secureConnect was successful');
  });

  await client.waitUntilConnected();
  const response = await client.send(12, Buffer.from('something'));

  await closeSockets(server, client);

  t.deepEqual(response.command, 24, 'client received correct command');
  t.deepEqual(response.data.toString(), 'something else', 'client received correct data');
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
    response.reply(request.command, request.data);
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  await client.waitUntilConnected();

  const responses = await Promise.all([
    client.send(101, Buffer.from('test1')),
    client.send(102, Buffer.from('test2')),
    client.send(103, Buffer.from('test3')),
    client.send(104, Buffer.from('test4')),
    client.send(105, Buffer.from('test5'))
  ]);

  await closeSockets(server, client);

  t.deepEqual(responses, [
    { command: 101, data: Buffer.from('test1'), json: responses[0].json },
    { command: 102, data: Buffer.from('test2'), json: responses[1].json },
    { command: 103, data: Buffer.from('test3'), json: responses[2].json },
    { command: 104, data: Buffer.from('test4'), json: responses[3].json },
    { command: 105, data: Buffer.from('test5'), json: responses[4].json }
  ], 'server received all responses');
});

test('client sends error when server disconnects mid message', async t => {
  t.plan(1);

  const server = createServer({ port: 8000 }, function (request, response) {
    response.reply(100, Buffer.from('test'));
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000, reconnectDelay: 50 });
  server.close();

  client.send(101, Buffer.from('test2')).catch(async error => {
    await closeSockets(server, client);

    t.equal(error.message, 'client disconnected');
  });
});

test('client errors when server never starts', async t => {
  t.plan(1);

  const client = createClient({ host: '0.0.0.0', port: 8000, reconnectDelay: 50 });

  client.send(101, { a: 1 }).catch(error => {
    t.equal(error.message, 'client disconnected');
  });
  client.close();
});

test('one way communication', async t => {
  t.plan(4);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    response.reply(100, Buffer.from('test1'));
    response.send(101, Buffer.from('test2'));
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  await client.waitUntilConnected();
  client.on('message', async ({ command, data }) => {
    await closeSockets(server, client);

    t.equal(command, 101);
    t.deepEqual(data, Buffer.from('test2'));
  });
  const { command, data } = await client.send(103, Buffer.from('test3'));
  t.deepEqual(command, 100);
  t.deepEqual(data, Buffer.from('test1'));
});

test('one way communication - optional data', async t => {
  t.plan(4);

  const server = createServer({ host: 'localhost', port: 8000 }, function (request, response) {
    response.reply(100);
    response.send(101);
  });
  server.open();

  const client = createClient({ host: '0.0.0.0', port: 8000 });
  await client.waitUntilConnected();
  client.on('message', async ({ command, data }) => {
    await closeSockets(server, client);

    t.equal(command, 101);
    t.equal(data, undefined);
  });
  const { command, data } = await client.send(103, Buffer.from('test3'));
  t.deepEqual(command, 100);
  t.equal(data, undefined);
});

test.only('stress test and timings', async t => {
  t.plan(2);

  const startTime = Date.now();
  let succeeded = 0;
  for (let serverIndex = 0; serverIndex < 20; serverIndex++) {
    const server = createServer({ port: 8000 + serverIndex }, function (request, response) {
      response.reply(request.command, request.data);
    });
    server.open();

    const clientsPromises = mapTimes(50, async clientIndex => {
      const client = createClient({ host: '0.0.0.0', port: 8000 + serverIndex });
      await client.waitUntilConnected();
      const responses = await Promise.all([
        client.send(100, Buffer.from('test100')),
        client.send(101, Buffer.from('test101')),
        client.send(102, Buffer.from('test102')),
        client.send(103, Buffer.from('test103')),
        client.send(104, Buffer.from('test104'))
      ]);

      assert.deepStrictEqual(responses, [
        { command: 100, data: Buffer.from('test100'), json: responses[0].json },
        { command: 101, data: Buffer.from('test101'), json: responses[1].json },
        { command: 102, data: Buffer.from('test102'), json: responses[2].json },
        { command: 103, data: Buffer.from('test103'), json: responses[3].json },
        { command: 104, data: Buffer.from('test104'), json: responses[4].json }
      ]);
      succeeded = succeeded + 1;

      return client;
    });

    const clients = await Promise.all(clientsPromises);

    await closeSockets(server, ...clients);
  }

  const timeTaken = Date.now() - startTime;

  t.equal(succeeded, 1000);
  t.ok(timeTaken < 3000, 'should take less than 3 seconds (' + timeTaken + 'ms)');
});
