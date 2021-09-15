const { promisify } = require('util');
const increlation = require('increlation/async');

const split = require('./split');
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
  const askSequence = increlation(3, 65535);
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
          try {
            response._json = JSON.parse(decoded[2]);
          } catch (error) {
            error.command = decoded[1];
            error.data = decoded[2] && decoded[2].toString();
            throw error;
          }
        }

        return response._json;
      };

      if (responder) {
        responder.resolve(response);
        askSequence.release(decoded[0]);
      } else {
        client.emit('message', response);
      }
    };

    split(client, 1, 3, next);
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
        askSequence.release(key);
      });
      connected = false;
    });
  }

  makeConnection();

  async function send (command, data) {
    if (data && data.constructor.name !== 'Buffer') {
      data = Buffer.from(JSON.stringify(data));
    }

    const currentAskSequence = await askSequence.next();
    const currentAskSequenceValue = currentAskSequence.value;

    if (!connected) {
      throw new Error('client disconnected');
    }

    return new Promise((resolve, reject) => {
      client.write(miniler.encode(currentAskSequenceValue, command, data));
      client.write(newLine);

      responders[currentAskSequenceValue] = { resolve, reject };
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
