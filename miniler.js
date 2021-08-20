function encode (id, command, data) {
  if (id < 2 || id > (256 * 256)) {
    throw new Error('tcpocket:encode - id must be an integer between 2 and ' + (256 * 256));
  }

  if (command < 2 || command > 255) {
    throw new Error('tcpocket:encode - command must be an integer between 2 and 255');
  }

  const id16 = new Int16Array([id]);
  const id8 = new Uint8Array(id16.buffer);
  const command8 = new Uint8Array([command]);

  const header = Buffer.from([
    id8[0], id8[1], command8[0]
  ]);

  return data
    ? Buffer.concat([
      header,
      data
    ])
    : header;
}

function decode (buffer) {
  const id8 = new Uint8Array([buffer[0], buffer[1]]);
  const id = new Uint16Array(id8.buffer);

  const command = buffer[2];

  return buffer.length > 3
    ? [
        id[0],
        command,
        buffer.slice(3)
      ]
    : [
        id[0],
        command
      ];
}

module.exports = {
  encode,
  decode
};
