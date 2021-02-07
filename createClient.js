const EventEmitter = require('events');

const ndJsonFe = require('ndjson-fe');

function proxyEventEmitter (sourceEmitter, destinationEmitter) {
  const originalEmit = sourceEmitter.emit.bind(sourceEmitter);
  sourceEmitter.emit = (...args) => {
    if (args[0] !== 'error') {
      destinationEmitter.emit(...args);
    }

    originalEmit(...args);
  };
}

function createClient ({ reconnectDelay = 250, ...connectionOptions }) {
  let client;
  let askSequence = 0;
  let stopped;
  let connected = false;
  let writeQueue = [];

  const eventEmitter = new EventEmitter();

  const responders = {};

  function handler () {
    const feed = ndJsonFe();

    feed.on('next', row => {
      const responder = responders[row[0]];
      delete responders[row[0]];

      if (responder) {
        responder(row[1]);
      } else {
        eventEmitter.emit('message', row[1]);
      }
    });

    client.pipe(feed);
  }

  let reconnectTimer;
  function reconnect () {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      makeConnection();
    }, reconnectDelay);
  }

  function makeConnection () {
    if (client) {
      client.destroy();
    }

    if (connectionOptions.key) {
      client = require('tls').connect(connectionOptions, handler);
    } else {
      client = require('net').createConnection(connectionOptions, handler);
    }

    proxyEventEmitter(client, eventEmitter);

    client.on('connect', () => {
      connected = true;
      writeQueue.forEach(callback => {
        callback();
      });
      writeQueue = [];
    });

    client.on('close', () => {
      connected = false;
      if (!stopped) {
        reconnect();
        return;
      }

      writeQueue.forEach(callback => {
        callback(new Error('tcpocket: client stopped'));
      });
      writeQueue = [];
    });

    client.on('error', (error, data) => {
      if (['EADDRNOTAVAIL', 'CLOSED', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code)) {
        reconnect();
        return;
      }

      eventEmitter.emit('error', error, data);
    });

    client.setMaxListeners(100);
  }

  makeConnection();

  function waitUntilConnected (callback) {
    if (connected) {
      callback();
      return;
    }

    writeQueue.push(callback);
  }

  function send (data) {
    const currentAskSequence = askSequence++;

    return new Promise((resolve, reject) => {
      waitUntilConnected((error) => {
        if (error) {
          error.data = data;
          reject(error);
          return;
        }
        client.write(JSON.stringify([currentAskSequence, data]) + '\n');
      });

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
        stopped = true;
        resolve();
        return;
      }

      stopped = true;

      const socketIsOpen = (client.writable === false && client.readable === false);
      if (socketIsOpen) {
        client.destroy();
        resolve();
        return;
      }

      client.once('close', () => {
        resolve();
      });
      client.once('error', () => {
        resolve();
      });
      client.destroy();
    }),

    send
  };
}

module.exports = createClient;
