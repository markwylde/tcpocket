const EventEmitter = require('events');

const parseNewMessage = require('./utils/parseNewMessage');
const createDataBuffer = require('./utils/createDataBuffer');

function createServer ({ port, tls }) {
  return new Promise((resolve, reject) => {
    const eventEmitter = new EventEmitter();

    function handler (connection) {
      createDataBuffer(connection, data => {
        parseNewMessage(eventEmitter, connection, data);
      });

      eventEmitter.emit('connected', {
        _connection: connection,
        send: (c, d) => connection.write(JSON.stringify({ c, d }) + '\n')
      });

      connection.on('end', () => {
        eventEmitter.emit('disconnected');
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
      eventEmitter.emit('connected');
    });
  });
}

module.exports = createServer
;
