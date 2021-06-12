const ndJsonFe = require('ndjson-fe');

function createServer (options, handler) {
  const sockets = [];
  function wrapper (socket) {
    sockets.push(socket);

    const feed = ndJsonFe();

    const next = data => {
      try {
        handler({
          socket,
          data: data[1]
        }, {
          send: responseData => {
            socket.write(JSON.stringify(['?', responseData]) + '\n');
          },
          reply: responseData => {
            socket.write(JSON.stringify([data[0], responseData]) + '\n');
          }
        });
      } catch (error) {
        process.nextTick(() => {
          throw error;
        });
      }
    }

    feed.on('next', next);

    feed.on('error', function (error) {
      if (error.includes('Invalid JSON received')) {
        socket.write(JSON.stringify(['?', error]) + '\n');
        socket.pipe(feed);
        return
      } 
      throw error;
    });

    socket.pipe(feed);
  }

  const server = options.key ? require('tls').createServer(options, wrapper) : require('net').createServer(wrapper);

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
