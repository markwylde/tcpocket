# TCPocket
[![Build Status](https://travis-ci.org/markwylde/tcpocket.svg?branch=master)](https://travis-ci.org/markwylde/tcpocket)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/markwylde/tcpocket)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/markwylde/tcpocket)](https://github.com/markwylde/tcpocket/blob/master/package.json)
[![GitHub](https://img.shields.io/github/license/markwylde/tcpocket)](https://github.com/markwylde/tcpocket/blob/master/LICENSE)

A request response communication wrapper around a tcp server/client.

## Example usage
### Insecure
```javascript
const tcpocket = require('tcpocket');

async function main () {
  const server = tcpocket.createServer({ port: 8000 }, function (request, response) {
    response.send({ b: 2 });
  });
  server.open();

  const client = tcpocket.createClient({ host: '0.0.0.0', port: 8000 });
  await client.send({ a: 1 });
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
  const server = tcpocket.createServer({ port: 8000, tls }, function (request, response) {
    response.send({ b: 2 });
  });
  server.open();

  const client = tcpocket.createClient({ host: '0.0.0.0', port: 8000, tls });
  await client.send({ a: 1 });
}

main();
```

# License
This project is licensed under the terms of the MIT license.
