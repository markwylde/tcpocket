const assert = require('assert');
const test = require('basictap');

const miniler = require('../miniler.js');

test('miniler - encode and decode', t => {
  t.plan(1);

  for (let i = 0; i < 5000; i++) {
    const args = [65534, 25, Buffer.from('test something')];

    const encoded = miniler.encode(...args);
    const decoded = miniler.decode(encoded);

    assert.deepStrictEqual(encoded, Buffer.from([0xfe, 0xff, 0x19, 0x74, 0x65, 0x73, 0x74, 0x20, 0x73, 0x6f, 0x6d, 0x65, 0x74, 0x68, 0x69, 0x6e, 0x67]));
    assert.deepStrictEqual(decoded, args);
  }

  t.pass();
});

test('miniler - encode and decode with no data', t => {
  t.plan(1);

  for (let i = 0; i < 5000; i++) {
    const args = [65534, 25];

    const encoded = miniler.encode(...args);
    const decoded = miniler.decode(encoded);

    assert.deepStrictEqual(encoded, Buffer.from([0xfe, 0xff, 0x19]));
    assert.deepStrictEqual(decoded, args);
  }

  t.pass();
});
