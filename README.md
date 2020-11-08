# TCPocket
![Node.js Test Runner](https://github.com/markwylde/tcpocket/workflows/Node.js%20Test%20Runner/badge.svg)
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
    console.log(request.data) // === { a: 1 }

    // You can reply only once
    response.reply({ b: 2 });

    // Sending happens outside of a reply and can be called multiple times
    response.send({ another: 'message' });
  });
  server.open();

  const client = tcpocket.createClient({ host: '0.0.0.0', port: 8000 });
  client.on('message', (data) => {
    console.log(data) // === { b: 2 }
  });

  const response = await client.send({ a: 1 });
  console.log(response) // === { b: 2 }
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
    console.log(request.data) // === { a: 1 }

    // You can reply only once
    response.reply({ b: 2 });

    // Sending happens outside of a reply and can be called multiple times
    response.send({ another: 'message' });
  });
  server.open();

  const client = tcpocket.createClient({ host: '0.0.0.0', port: 8000, tls });
  const response = await client.send({ a: 1 });
  console.log(response) // === { b: 2}
}

main();
```

# License
This project is licensed under the terms of the MIT license.
