const EventEmitter = require('events');

const ndJsonFe = require('ndjson-fe');

const parseNewMessage = require('./utils/parseNewMessage');

function createClient ({ host, port, tls }) {
  return new Promise((resolve, reject) => {
    let client;
    const eventEmitter = new EventEmitter();

    function connectError (error) {
      reject(error);
    }

    function handler () {
      const responders = {};
      let askSequence = 0;

      client.off('error', connectError);
      client.on('error', (error) => {
        eventEmitter.emit('error', error);
      });

      const feed = ndJsonFe();

      feed.on('next', row => {
        const responder = responders[row.a];
        delete responders[row.a];

        if (responder) {
          responder(row.d);
          return;
        }

        parseNewMessage(eventEmitter, client, row);
      });

      client.pipe(feed);

      resolve({
        _eventEmitter: eventEmitter,
        on: eventEmitter.on.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        send: (c, d) => client.write(JSON.stringify({ c, d }) + '\n'),
        ask: (c, d) => {
          const currentAskSequence = askSequence++;

          client.write(JSON.stringify({
            a: currentAskSequence, c, d
          }) + '\n');

          return new Promise((resolve) => {
            responders[currentAskSequence] = resolve;
          });
        },
        close: (fn) => client.end(fn)
      });

      client.on('end', () => {
        eventEmitter.emit('disconnected');
      });
    }

    if (tls) {
      client = require('tls').connect(port, host, tls, handler);
    } else {
      client = require('net').createConnection({ host, port }, handler);
    }

    client.setMaxListeners(100);

    client.on('error', connectError);

    client.on('data', (data) => {
      eventEmitter.emit('data', data);
    });
  });
}

module.exports = createClient;
