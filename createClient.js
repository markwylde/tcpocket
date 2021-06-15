const { promisify } = require('util');
const split = require('binary-split');

const miniler = require('./miniler.js');

const newLine = new Uint8Array([1]);

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
  let askSequence = 3;
  let stopped;
  let connected = false;

  const responders = {};

  function handler () {
    const next = buffer => {
      const decoded = miniler.decode(buffer);

      const responder = responders[decoded[0]];
      delete responders[decoded[0]];

      const response = {
        command: decoded[1],
        data: decoded[2]
      };

      response.json = () => {
        if (!response._json) {
          response._json = JSON.parse(decoded[2]);
        }

        return response._json;
      };

      if (responder) {
        responder.resolve(response);
      } else {
        client.emit('message', response);
      }
    };

    client
      .pipe(split([1]))
      .on('data', next);
  }

  function makeConnection () {
    client = connectionOptions.key
      ? require('tls').connect(connectionOptions, handler)
      : require('net').createConnection(connectionOptions, handler);

    client.on('connect', () => {
      connected = true;
    });

    client.on('close', async () => {
      Object.keys(responders).forEach(key => {
        responders[key].reject(new Error('client disconnected'));
      });
      connected = false;
    });
  }

  makeConnection();

  function send (command, data) {
    if (data && data.constructor.name === 'Object') {
      data = Buffer.from(JSON.stringify(data));
    }

    if (askSequence > (256 * 256)) {
      askSequence = 3;
    }
    const currentAskSequence = askSequence++;

    return new Promise((resolve, reject) => {
      if (!connected) {
        reject(new Error('client disconnected'));
        return;
      }

      client.write(miniler.encode(currentAskSequence, command, data));
      client.write(newLine);

      responders[currentAskSequence] = { resolve, reject };
    });
  }

  return {
    client,

    once: client.once.bind(client),
    on: client.addListener.bind(client),
    off: client.removeListener.bind(client),

    waitUntilConnected: () => {
      return waitUntil(() => {
        return connected;
      });
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
