const EventEmitter = require('events');

const parseNewMessage = require('./utils/parseNewMessage');
const createDataBuffer = require('./utils/createDataBuffer');

function waitForSequenceResponse (sequence, client) {
  return new Promise((resolve) => {
    createDataBuffer(client, (data, turnOff) => {
      try {
        data = JSON.parse(data.toString());
      } catch (err) {}

      if (data.a === sequence) {
        resolve(data.d);
        turnOff();
      }
    });
  });
}

function createClient ({ host, port, tls }) {
  return new Promise((resolve, reject) => {
    const eventEmitter = new EventEmitter();

    function handler () {
      let askSequence = 0;

      createDataBuffer(client, data => {
        parseNewMessage(eventEmitter, client, data);
      });

      resolve({
        _eventEmitter: eventEmitter,
        on: eventEmitter.on.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        send: (c, d) => client.write(JSON.stringify({ c, d }) + '\n'),
        ask: (c, d) => {
          const currentAskSequence = askSequence++;

          client.write(JSON.stringify({
            a: currentAskSequence, c, d
          }) + '\n');

          return waitForSequenceResponse(currentAskSequence, client);
        },
        close: () => client.end()
      });

      client.on('end', () => {
        eventEmitter.emit('disconnected');
      });
    }

    let client;
    if (tls) {
      client = require('tls').connect(port, host, tls, handler);
    } else {
      client = require('net').createConnection({ host, port }, handler);
    }

    client.on('error', (err) => {
      console.log(err);
      eventEmitter.emit('error');
    });

    client.on('data', (data) => {
      eventEmitter.emit('data', data);
    });
  });
}

module.exports = createClient;
