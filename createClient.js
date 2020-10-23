const EventEmitter = require('events');

const ndJsonFe = require('ndjson-fe');

function proxyEventEmitter (sourceEmitter, destinationEmitter) {
  const originalEmit = sourceEmitter.emit.bind(sourceEmitter);
  sourceEmitter.emit = (...args) => {
    if (args[0] !== 'error') {
      originalEmit(...args);
    }
    destinationEmitter.emit(...args);
  };
}

function createClient ({ host, port, tls }) {
  let client;
  let activeSocket;
  let askSequence = 0;
  const eventEmitter = new EventEmitter();

  const responders = {};

  function handler (socket) {
    activeSocket = socket;

    const feed = ndJsonFe();

    feed.on('next', row => {
      const responder = responders[row[0]];
      delete responders[row[0]];

      if (responder) {
        responder(row[1]);
      }
    });

    client.pipe(feed);
  }

  if (tls) {
    client = require('tls').connect(port, host, tls, handler);
  } else {
    client = require('net').createConnection({ host, port }, handler);
  }

  proxyEventEmitter(client, eventEmitter);

  client.setMaxListeners(100);

  function send (data) {
    const currentAskSequence = askSequence++;

    client.write(JSON.stringify([currentAskSequence, data]) + '\n');

    return new Promise((resolve) => {
      responders[currentAskSequence] = resolve;
    });
  }

  return {
    client,

    eventEmitter,
    on: eventEmitter.addListener.bind(eventEmitter),
    off: eventEmitter.removeListener.bind(eventEmitter),

    close: () => activeSocket && activeSocket.close(),

    send
  };
}

module.exports = createClient;
