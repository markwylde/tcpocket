const fs = require('fs');
const test = require('tape');

const ddb = require('../');

function expectConnectionRejectError () {
  return (error) => {
    if (error.code !== 'ECONNRESET') {
      throw error;
    }
  };
}

function closeSockets (...args) {
  args.forEach(arg => arg.close());
}

test('basic two way server connection works', t => {
  t.plan(2);

  (async function () {
    const server = await ddb.createServer();
    server.on('testCmd', (data, sender) => {
      t.deepEqual(data, { a: 1 }, 'server received a testCmd');

      sender.send('testResp', { b: 2 });
    });
    server.listen(8000);

    const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 });
    client.send('testCmd', { a: 1 });
    client.send('testNotCmd', { none: 0 });
    client.on('testResp', (data, sender) => {
      t.deepEqual(data, { b: 2 }, 'client received a testResp');
      closeSockets(server, client);
    });
  })();
});

test('basic two way server connection works with certs', t => {
  t.plan(2);

  (async function () {
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

    const server = await ddb.createServer({ tls: serverTls });
    server.on('testCmd', (data, sender) => {
      t.deepEqual(data, { testing123: 1 }, 'server received a testCmd');

      sender.send('testResp', { b: 2 });
    });
    server.listen(8000);

    const client = await ddb.createClient({ host: 'localhost', port: 8000, tls: clientTls });

    client.send('testCmd', { testing123: 1 });
    client.send('testNotCmd', { none: 0 });
    client.on('testResp', (data, sender) => {
      t.deepEqual(data, { b: 2 }, 'client received a testResp');
      client.on('error', expectConnectionRejectError);
      closeSockets(server, client);
    });
  })();
});

test('basic two way server connection works with certs (wrongly signed)', t => {
  t.plan(1);

  (async function () {
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

    const server = await ddb.createServer({ tls: serverTls });
    server.listen(8000);

    ddb.createClient({ host: 'localhost', port: 8000, tls: clientTls })
      .catch((error) => {
        console.log(error.code);
        t.equal(error.code, 'CERT_SIGNATURE_FAILURE');
        closeSockets(server);
        throw error;
      })
      .then(() => {
        t.fail('connect was successful');
      });
  })();
});

test('server can send data to new client', t => {
  t.plan(1);

  (async function () {
    const server = await ddb.createServer();
    server.listen(8000);
    server.on('connected', (sender) => {
      sender.send('testResp', { b: 2 });
    });

    const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 });
    client.on('testResp', (data, sender) => {
      t.deepEqual(data, { b: 2 }, 'client received a testResp');
      closeSockets(server, client);
    });
  })();
});

test('client can send data once connected to server', t => {
  t.plan(1);

  (async function () {
    const server = await ddb.createServer();
    server.listen(8000);
    server.on('testCmd', (data, sender) => {
      t.deepEqual(data, { a: 1 }, 'server received a testCmd');

      closeSockets(server, client);
    });

    const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 });
    client.send('testCmd', { a: 1 });
  })();
});

test('client can ask and get a response', t => {
  t.plan(1);

  (async function () {
    const server = await ddb.createServer();
    server.listen(8000);
    server.on('testCmd', (data, sender) => {
      sender.reply({ a: 1 });
    });

    const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 });
    const response = await client.ask('testCmd', { a: 1 });

    t.deepEqual(response, { a: 1 }, 'server received a testCmd');

    closeSockets(server, client);
  })();
});

test('client can ask and get multiple responses', t => {
  t.plan(1);

  (async function () {
    const server = await ddb.createServer();
    server.listen(8000);
    server.on('testCmd', (data, sender) => {
      sender.reply({ ar: data.a });
    });

    const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 });
    const responses = await Promise.all([
      client.ask('testCmd', { a: 1 }),
      client.ask('testCmd', { a: 2 }),
      client.ask('testCmd', { a: 3 }),
      client.ask('testCmd', { a: 4 }),
      client.ask('testCmd', { a: 10 })
    ]);

    t.deepEqual(responses, [
      { ar: 1 },
      { ar: 2 },
      { ar: 3 },
      { ar: 4 },
      { ar: 10 }
    ], 'server received all responses');

    closeSockets(server, client);
  })();
});
