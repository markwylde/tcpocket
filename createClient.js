const EventEmitter = require('events');
const { promisify } = require('util');
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

const waitUntil = promisify(function (fn, cb) {
  const result = fn();
  if (!result) {
    setTimeout(() => waitUntil(fn, cb));
    return;
  }

  cb();
});

function createClient ({ ...connectionOptions }) {
  let client;
  let askSequence = 0;
  let stopped;
  let connected = false;

  const eventEmitter = new EventEmitter();

  const responders = {};

  function handler () {
    const feed = ndJsonFe();

    feed.on('next', row => {
      const responder = responders[row[0]];
      delete responders[row[0]];

      if (responder) {
        responder.resolve(row[1]);
      } else {
        eventEmitter.emit('message', row[1]);
      }
    });

    client.pipe(feed);
  }

  function makeConnection () {
    if (connectionOptions.key) {
      client = require('tls').connect(connectionOptions, handler);
    } else {
      client = require('net').createConnection(connectionOptions, handler);
    }

    proxyEventEmitter(client, eventEmitter);

    client.on('connect', () => {
      connected = true;
    });

    client.on('close', async () => {
      Object.keys(responders).forEach(key => {
        responders[key].reject(new Error('client disconnected'));
      });
      connected = false;
    });

    client.on('error', (error, data) => {
      eventEmitter.emit('error', error, data);
    });

    client.setMaxListeners(100);
  }

  makeConnection();

  function send (data) {
    const currentAskSequence = askSequence++;

    return new Promise((resolve, reject) => {
      if (!connected) {
        reject(new Error('client disconnected'));
        return;
      }

      client.write(JSON.stringify([currentAskSequence, data]) + '\n');

      responders[currentAskSequence] = { resolve, reject };
    });
  }

  return {
    client,

    eventEmitter,
    once: eventEmitter.once.bind(eventEmitter),
    on: eventEmitter.addListener.bind(eventEmitter),
    off: eventEmitter.removeListener.bind(eventEmitter),

    waitUntilConnected: () => {
      return waitUntil(() => {
        return connected;
      })
    },

    close: async function (force) {
      if (!client || stopped) {
        stopped = true;
        return;
      }

      stopped = true;

      return new Promise(resolve => {
        const socketIsOpen = (client.writable === true || client.readable === true);
        if (!socketIsOpen) {
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
      });
    },

    send
  };
}

module.exports = createClient;
