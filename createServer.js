const EventEmitter = require('events');

const split = require('./split');
const miniler = require('./miniler.js');

const newLine = new Uint8Array([1]);

function createServer (options, handler) {
  const sockets = [];

  const eventEmitter = new EventEmitter();

  function wrapper (socket) {
    eventEmitter.emit('connection', socket);
    sockets.push(socket);

    const next = buffer => {
      const decoded = miniler.decode(buffer);
      try {
        const hand = {
          socket,
          command: decoded[1],
          data: decoded[2]
        };

        hand.json = () => {
          if (!hand._json) {
            hand._json = JSON.parse(decoded[2]);
          }

          return hand._json;
        };

        handler(hand, {
          send: (command, data) => {
            if (data && data.constructor.name === 'Object') {
              data = Buffer.from(JSON.stringify(data));
            }

            socket.write(miniler.encode(2, command, data));
            socket.write(newLine);
          },
          reply: (command, data) => {
            if (data && data.constructor.name === 'Object') {
              data = Buffer.from(JSON.stringify(data));
            }

            socket.write(miniler.encode(decoded[0], command, data));
            socket.write(newLine);
          }
        });
      } catch (error) {
        process.nextTick(() => {
          throw error;
        });
      }
    };

    split(socket, 1, 3, next);
  }

  const server = options.key
    ? require('tls').createServer(options, wrapper)
    : require('net').createServer(wrapper);

  return {
    ...server,

    once: eventEmitter.once.bind(eventEmitter),
    on: eventEmitter.addListener.bind(eventEmitter),
    off: eventEmitter.removeListener.bind(eventEmitter),

    open: () => {
      server.listen(options.port);
    },

    close: (fn) => {
      sockets.forEach(socket => {
        try {
          socket.destroy();
        } catch (error) {
          console.log(error);
        }
      });

      server.close();

      fn && fn();
    }
  };
}

module.exports = createServer;
