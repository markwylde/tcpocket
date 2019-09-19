const ddb = require('../')
const test = require('tape')

function closeSockets (...args) {
  args.forEach(arg => arg.close())
}

test('basic two way server connection works', async t => {
  t.plan(2)

  const server = await ddb.createServer({ port: 8000 })
  server.on('testCmd', (data, sender) => {
    t.deepEqual(data, { a: 1 }, 'server received a testCmd')

    sender.send('testResp', { b: 2 })
  })

  const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 })
  client.send('testCmd', { a: 1 })
  client.send('testNotCmd', { none: 0 })
  client.on('testResp', (data, sender) => {
    t.deepEqual(data, { b: 2 }, 'client received a testResp')
    closeSockets(server, client)
  })
})

test('server can send data to new client', async t => {
  t.plan(1)

  const server = await ddb.createServer({ port: 8000 })
  server.on('connected', (sender) => {
    sender.send('testResp', { b: 2 })
  })

  const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 })
  client.on('testResp', (data, sender) => {
    t.deepEqual(data, { b: 2 }, 'client received a testResp')
    closeSockets(server, client)
  })
})

test('client can send data once connected to server', async t => {
  t.plan(1)

  const server = await ddb.createServer({ port: 8000 })
  server.on('testCmd', (data, sender) => {
    t.deepEqual(data, { a: 1 }, 'server received a testCmd')

    closeSockets(server, client)
  })

  const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 })
  client.send('testCmd', { a: 1 })
})

test('client can ask and get a response', async t => {
  t.plan(1)

  const server = await ddb.createServer({ port: 8000 })
  server.on('testCmd', (data, sender) => {
    sender.reply({ a: 1 })
  })

  const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 })
  const response = await client.ask('testCmd', { a: 1 })

  t.deepEqual(response, { a: 1 }, 'server received a testCmd')

  closeSockets(server, client)
})

test('client can ask and get multiple responses', async t => {
  t.plan(1)

  const server = await ddb.createServer({ port: 8000 })
  server.on('testCmd', (data, sender) => {
    sender.reply({ ar: data.a })
  })

  const client = await ddb.createClient({ host: '0.0.0.0', port: 8000 })
  const responses = await Promise.all([
    client.ask('testCmd', { a: 1 }),
    client.ask('testCmd', { a: 2 }),
    client.ask('testCmd', { a: 3 }),
    client.ask('testCmd', { a: 4 }),
    client.ask('testCmd', { a: 10 })
  ])

  t.deepEqual(responses, [
    {ar: 1 },
    {ar: 2 },
    {ar: 3 },
    {ar: 4 },
    {ar: 10 }
  ], 'server received all responses')

  closeSockets(server, client)
})
