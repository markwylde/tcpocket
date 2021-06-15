const split = require('binary-split');
const miniler = require('./miniler.js');

const newLine = new Uint8Array([0x0a]);

function createServer (options, handler) {
  const sockets = [];

  function wrapper (socket) {
    sockets.push(socket);

    const next = buffer => {
      const decoded = miniler.decode(buffer);
      try {
        handler({
          socket,
          command: decoded[1],
          data: decoded[2]
        }, {
          send: (command, data) => {
            socket.write(miniler.encode(0, command, data));
            socket.write(newLine);
          },
          reply: (command, data) => {
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

    socket
      .pipe(split([0x0a]))
      .on('data', next);
  }

  const server = options.key
    ? require('tls').createServer(options, wrapper)
    : require('net').createServer(wrapper);

  return {
    ...server,

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

      server.close(fn);
    }
  };
}

module.exports = createServer;
