# TCPocket
![Node.js Test Runner](https://github.com/markwylde/tcpocket/workflows/Node.js%20Test%20Runner/badge.svg)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/markwylde/tcpocket)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/markwylde/tcpocket)](https://github.com/markwylde/tcpocket/blob/master/package.json)
[![GitHub](https://img.shields.io/github/license/markwylde/tcpocket)](https://github.com/markwylde/tcpocket/blob/master/LICENSE)

A request response communication wrapper around a tcp server/client.

## API
### tcpocket.createServer(options, handler)
The handler will execute with a request and response argument.

### request
A request will have command (a number between 0 and 255), and optionally some data (a buffer).

### response
A response has two commands (reply, send).
You can `reply` only once, and that will resolve the promise on the client.
You can `send` many times, but the server will not correlate this with the request.

## Example usage
### Insecure
```javascript
const tcpocket = require('tcpocket');

// A command must be a number between 0 and 255
const TEST1 = 123;
const TEST2 = 125;
const TEST3 = 128;

async function main () {
  const server = tcpocket.createServer({ port: 8000 }, function (request, response) {
    console.log(request.command) // === TEST1 || 123
    console.log(request.data) // === <Buffer>'some data'

    // You can reply only once
    response.reply(TEST2, Buffer.from('some reply'));

    // Sending happens outside of a reply and can be called multiple times
    response.send(TEST3, Buffer.from('some extra data'));
  });
  server.open();

  const client = tcpocket.createClient({ host: '0.0.0.0', port: 8000 });
  client.on('message', ({ command, data }) => {
    console.log(command) // === TEST3
    console.log(data) // === 'some extra data'
  });

  await client.waitUntilReady();
  const { command, data} = await client.send(TEST1, Buffer.from('some data'));
  console.log(command) // === TEST2
  console.log(data) // === 'some reply''
}

main();
```

### Using TLS
There is a file `./makeCerts.sh` that will create the certs used in the example below.

```javascript
const fs = require('fs');
const tcpocket = require('tcpocket');

const tls = {
  key: fs.readFileSync('./certs/localhost.privkey.pem'),
  cert: fs.readFileSync('./certs/localhost.cert.pem'),
  ca: [fs.readFileSync('./certs/ca.cert.pem')]
};

async function main () {
  const server = tcpocket.createServer({ port: 8000, ...tls }, function (request, response) {
    console.log(request.command) // === TEST1 || 123
    console.log(request.data) // === <Buffer> 'some data'

    // You can reply only once
    response.reply(TEST2, Buffer.from('some reply'));

    // Sending happens outside of a reply and can be called multiple times
    response.send(TEST3, Buffer.from('some extra data'));
  });
  server.open();

  const client = tcpocket.createClient({ host: '0.0.0.0', port: 8000 });
  client.on('message', ({ command, data }) => {
    console.log(command) // === TEST3
    console.log(data) // === 'some extra data'
  });

  await client.waitUntilReady();
  const { command, data} = await client.send(TEST1, Buffer.from('some data'));
  console.log(command) // === TEST2
  console.log(data) // === 'some reply''
}

main();
```

# License
This project is licensed under the terms of the MIT license.
