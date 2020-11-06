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

function createClient ({ host, port, tls, reconnectDelay = 250 }) {
  let client;
  let askSequence = 0;
  let stopped;
  const eventEmitter = new EventEmitter();

  const responders = {};

  function handler () {
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

  let reconnectTimer;
  function reconnect () {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      client.connect({ host, port });
    }, reconnectDelay);
  }
  client.on('close', () => {
    if (!stopped) {
      reconnect();
    }
  });

  client.on('error', (error, data) => {
    if (['EADDRNOTAVAIL', 'CLOSED', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code)) {
      reconnect();
      return;
    }

    eventEmitter.emit('error', error, data);
  });

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
    once: eventEmitter.once.bind(eventEmitter),
    on: eventEmitter.addListener.bind(eventEmitter),
    off: eventEmitter.removeListener.bind(eventEmitter),

    close: () => new Promise(resolve => {
      if (!client || stopped) {
        resolve()
        return
      }

      stopped = true;

      client.once('close', () => {
        resolve()
      })
      client.destroy();
    }),

    send
  };
}

module.exports = createClient;
