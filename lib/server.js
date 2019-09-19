const net = require('net')
const EventEmitter = require('events')

const parseNewMessage = require('./utils/parseNewMessage')
const createDataBuffer = require('./utils/createDataBuffer')

function createServer ({port}) {
  return new Promise((resolve, reject) => {
    const eventEmitter = new EventEmitter()

    const server = net.createServer(connection => {
      createDataBuffer(connection, data => {
        parseNewMessage(eventEmitter, connection, data)
      })

      eventEmitter.emit('connected', {
        _connection: connection,
        send: (c, d) => connection.write(JSON.stringify({c, d}) + '\n'),
      })

      connection.on('end', () => {
        eventEmitter.emit('disconnected')
      })
    })

    server.on('error', (err) => {
      eventEmitter.emit('error')
    })

    server.listen(port, () => {
      resolve({
        _eventEmitter: eventEmitter,
        on: eventEmitter.on.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        close: () => server.close()
      })
      eventEmitter.emit('connected')
    })
  })
}

module.exports = createServer