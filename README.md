# pouchdb-hypercore

[![Build Status](https://travis-ci.com/garbados/pouchdb-hypercore.svg?branch=master)](https://travis-ci.com/garbados/pouchdb-hypercore)
[![Coverage Status](https://coveralls.io/repos/github/garbados/pouchdb-hypercore/badge.svg?branch=master)](https://coveralls.io/github/garbados/pouchdb-hypercore?branch=master)
[![Stability](https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)](https://nodejs.org/api/documentation.html#documentation_stability_index)
[![NPM Version](https://img.shields.io/npm/v/@garbados/pouchdb-hypercore.svg?style=flat-square)](https://www.npmjs.com/package/@garbados/pouchdb-hypercore)
[![JS Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

A [PouchDB](https://pouchdb.com/) plugin that maps records in [hypercores](https://github.com/hypercore-protocol/hypercore), a P2P append-only datastructure, to a PouchDB or CouchDB instance. The plugin allows you to follow changes in hypercores locally and remotely. In this way, you can build up a database from multiple P2P sources.

As an example, here's how to set up a PouchDB instance to follow a hypercore:

```javascript
const Hypercore = require('hypercore')
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-hypercore'))

async function main () {
  // setup
  const hypercore = Hypercore('.example_hypercore')
  const pouch = new PouchDB('.example_pouchdb')
  await pouch.fromHypercore(hypercore)
  const key = hypercore.key.toString('hex')
  // hypercore -> pouchdb
  const seq = await new Promise((resolve, reject) => {
    this.hyper.append(JSON.stringify({ hello: 'world' }), (err, seq) => {
      if (err) { reject(err) } else { resolve(seq) }
    })
  })
  await new Promise((resolve) => { setTimeout(resolve, 100) })
  const doc = await this.pouch.get(`${key}@${seq}`)
  console.log(doc)
  >>> {_id: '{key}@{seq}', _rev: '1-...', hello: 'world' }
}
```

## Why?

PouchDB and CouchDB are, at this point, enduring and reliable projects with powerful capabilities. Besides their distinctive sync capabilities and efficient map-reduce indexing, CouchDB and PouchDB have vibrant ecosystems of tools, documentation, plugins, and other goodies that reflect the ecosystem's maturity.

The [Hypercore protocol](https://hypercore-protocol.org/) has been used to build fascinating P2P projects like [Beaker](https://beakerbrowser.com/) and [Cabal](https://cabal.chat/). In essence, it gives you *mutable torrents* by way of a distributed append-only log. In fact it uses the same tracker infrastructure as torrents.

By mirroring hypercores in this way, it becomes easy to produce hypercore-to-http gateways, or to utilize CouchDB's advanced indexing and querying systems.

### Why not map changes to writable hypercores?

This feature might return in the future, but for now it is unclear how to do this. Documents produced from hypercore log entries use `{key}@{seq}` as their ID, but it is impossible to determine that sequence number `{seq}` before appending the entry to the hypercore. There is also the matter of a hypercore and a PouchDB instance falling out of sync, which further complicates the task.

If you'd like to propose a solution, please chime in with an [issue](https://github.com/garbados/pouchdb-hypercore/issues).

## Install

Use [NPM](https://www.npmjs.com/):

```bash
$ npm i @garbados/pouchdb-hypercore
```

## Docs

The plugin adds or modifies the following methods of PouchDB instances:

### `async pouch.fromHypercore(hypercore)`

Streams changes from a hypercore into the database. Does not write changes to the hypercore.

```javascript
const pouch = new PouchDB(...)
pouch.fromHypercore(hypercore)
  .then(() => { /* ready */ })
```

### `async pouch.fromMultifeed(hypercore)`

Streams changes from all the hypercores in a [multifeed](https://github.com/kappa-db/multifeed) into the database. Does not write changes to the hypercore.

```javascript
const pouch = new PouchDB(...)
pouch.fromMultifeed(multifeed)
  .then(() => { /* ready */ })
```

## Test

`npm test`

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
