const EventEmitter = require('events');

const ndJsonFe = require('ndjson-fe');

const parseNewMessage = require('./utils/parseNewMessage');

function createServer ({ port, tls }) {
  return new Promise((resolve, reject) => {
    const eventEmitter = new EventEmitter();

    function handler (connection) {
      const feed = ndJsonFe();

      feed.on('next', row => {
        parseNewMessage(eventEmitter, connection, row);
      });

      connection.pipe(feed);

      eventEmitter.emit('connected', {
        _connection: connection,
        send: (c, d) => connection.write(JSON.stringify({ c, d }) + '\n')
      });
    }

    const server = tls ? require('tls').createServer(tls, handler) : require('net').createServer(handler);

    server.on('error', (error) => {
      eventEmitter.emit('error', error);
    });

    server.listen(port, () => {
      resolve({
        _eventEmitter: eventEmitter,
        on: eventEmitter.on.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        close: () => server.close()
      });
    });
  });
}

module.exports = createServer
;
