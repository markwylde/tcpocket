function createDataBuffer (connection, fn) {
  let buffer = '';
  function turnOff () {
    connection.off('data', action);
  }
  function action (data) {
    buffer = buffer + data.toString();
    if (buffer.includes('\n')) {
      const bufferSplit = buffer.split('\n');
      bufferSplit
        .filter(message => !!message)
        .forEach(message => fn(message, turnOff));
      buffer = '';
    }
  }
  connection.on('data', action);
}

module.exports = createDataBuffer;
