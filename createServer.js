const ndJsonFe = require('ndjson-fe');

function createServer ({ port, tls } = {}, handler) {
  const sockets = [];
  function wrapper (socket) {
    sockets.push(socket);

    const feed = ndJsonFe();

    feed.on('next', data => {
      try {
        handler({
          socket,
          data: data[1]
        }, {
          send: responseData => {
            socket.write(JSON.stringify([data[0], responseData]) + '\n');
          }
        });
      } catch (error) {
        process.nextTick(() => {
          throw error;
        });
      }
    });

    socket.pipe(feed);
  }

  const server = tls ? require('tls').createServer(tls, wrapper) : require('net').createServer(wrapper);

  return {
    ...server,

    open: () => {
      server.listen(port);
    },

    close: (fn) => {
      sockets.forEach(socket => {
        try {
          socket.destroy();
        } catch (_) {}
      });
      server.close(fn);
    }
  };
}

module.exports = createServer;
