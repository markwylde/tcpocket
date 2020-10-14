function parseNewMessage (eventEmitter, connection, data) {
  try {
    data = JSON.parse(data);
    eventEmitter.emit(data.c, data.d, {
      send: (c, d) => connection.write(JSON.stringify({ c, d }) + '\n'),
      reply: (d) => {
        connection.write(JSON.stringify({ a: data.a, d }) + '\n');
      }
    });
  } catch (err) {
    console.log(data);
    eventEmitter.emit('error', err);
  }
}

module.exports = parseNewMessage;
