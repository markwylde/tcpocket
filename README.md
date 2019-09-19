# TCPocket
[![Build Status](https://travis-ci.org/markwylde/tcpocket.svg?branch=master)](https://travis-ci.org/markwylde/tcpocket)
[![David DM](https://david-dm.org/markwylde/tcpocket.svg)](https://david-dm.org/markwylde/tcpocket)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/markwylde/tcpocket)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/markwylde/tcpocket)](https://github.com/markwylde/tcpocket/blob/master/package.json)
[![GitHub](https://img.shields.io/github/license/markwylde/tcpocket)](https://github.com/markwylde/tcpocket/blob/master/LICENSE)

A two way communication library using a pure tcp connection.

## Example usage
```javascript
const tcpocket = require('tcpocket')

async function main () {
  const server = await tcpocket.createServer({ port: 8000 })
  server.on('testCmd', (data, sender) => {
    console.log(data)
    sender.send('testResp', { b: 2 })
  })

  const client = await tcpocket.createClient({ host: '0.0.0.0', port: 8000 })
  client.on('testResp', (data, sender) => {
    console.log(data)
  })

  client.send('testCmd', { a: 1 })
}

main()
```

# License
This project is licensed under the terms of the GPLv3 license.
