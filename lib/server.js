const EventEmitter = require('events');

const ndJsonFe = require('ndjson-fe');

const parseNewMessage = require('./utils/parseNewMessage');

async function createServer ({ tls } = {}) {
  const eventEmitter = new EventEmitter();

  const connections = [];
  function handler (connection) {
    connections.push(connection);

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

  server.on('close', (data) => {
    eventEmitter.emit('close', data);
  });

  server.on('end', (data) => {
    eventEmitter.emit('end', data);
  });

  return {
    _eventEmitter: eventEmitter,
    server,
    listen: server.listen.bind(server),
    on: eventEmitter.on.bind(eventEmitter),
    off: eventEmitter.off.bind(eventEmitter),
    close: (fn) => {
      connections.forEach(connection => {
        try {
          connection.destroy();
        } catch (_) {}
      });
      server.close(fn);
    }
  };
}

module.exports = createServer;
