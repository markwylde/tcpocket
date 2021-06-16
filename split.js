function split (stream, separator, offset, next) {
  let buffer = Buffer.alloc(0);

  stream.on('data', data => {
    buffer = Buffer.concat([buffer, data]);

    let seperatorIndex;
    while (seperatorIndex !== -1) {
      seperatorIndex = buffer.indexOf(separator, offset - 1);

      if (seperatorIndex === -1) {
        return;
      }

      next(buffer.slice(0, seperatorIndex));
      buffer = buffer.slice(seperatorIndex + 1);
    }
  });
}

module.exports = split;
