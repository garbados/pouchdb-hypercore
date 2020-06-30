# pouchdb-hypercore

[![Build Status](https://img.shields.io/travis/garbados/pouchdb-hypercore/master.svg?style=flat-square)](https://travis-ci.org/garbados/pouchdb-hypercore)
[![Coverage Status](https://img.shields.io/coveralls/github/garbados/pouchdb-hypercore/master.svg?style=flat-square)](https://coveralls.io/github/garbados/pouchdb-hypercore?branch=master)
[![Stability](https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)](https://nodejs.org/api/documentation.html#documentation_stability_index)
[![NPM Version](https://img.shields.io/npm/v/pouchdb-hypercore.svg?style=flat-square)](https://www.npmjs.com/package/pouchdb-hypercore)
[![JS Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

A [PouchDB](https://pouchdb.com/) plugin that maps records in [hypercores](https://github.com/hypercore-protocol/hypercore), a P2P append-only datastructure, to and from a PouchDB or CouchDB instance. The plugin allows you to write changes to a writable hypercore, and also to follow changes to non-writable hypercores. In this way, you can build up a database from multiple P2P sources.

As an example, here's how to set up a PouchDB instance to follow a hypercore:

```javascript
const Hypercore = require('hypercore')
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-hypercore'))

async function main () {
  // setup
  const hypercore = Hypercore('.example_hypercore')
  const pouch = new PouchDB('.example_pouchdb')
  pouch.setHypercore(hypercore)
  // pouchdb -> hypercore
  await pouch.put({ _id: 'hello-world' })
  const docBuffer = await new Promise((resolve, reject) => {
    this.hyper.get(0, { wait: true }, (err, id) => {
      if (err) { reject(err) } else { resolve(id) }
    })
  })
  const doc1 = JSON.parse(docBuffer.toString('utf8'))
  console.log(doc1)
  >>> {_id: 'hello-world', _rev: '1-...'}
  // hypercore -> pouchdb
  await new Promise((resolve, reject) => {
    this.hyper.append(JSON.stringify({ _id: 'hello-galaxy' }), (err) => {
      if (err) { reject(err) } else { resolve() }
    })
  })
  await new Promise((resolve) => { setTimeout(resolve, 100) })
  const doc2 = await this.pouch.get('hello-galaxy')
  console.log(doc2)
  >>> {_id: 'hello-galaxy', _rev: '1-...'}
}
```

The plugin mirrors a hypercore feed with a PouchDB database, so that changes in one are reflected in the other.

To follow non-writable hypercores, use `.followHypercore`:

```javascript
pouch.followHypercore(remoteCore)
```

## Why?

PouchDB and CouchDB are, at this point, enduring and reliable projects with powerful capabilities. Besides their distinctive sync capabilities and efficient map-reduce indexing, CouchDB and PouchDB have vibrant ecosystems of tools, documentation, plugins, and other goodies that reflect the ecosystem's maturity.

The [Hypercore protocol](https://hypercore-protocol.org/) has been used to build fascinating P2P projects like [Beaker](https://beakerbrowser.com/) and [Cabal](https://cabal.chat/). In essence, it gives you *mutable torrents* by way of a distributed append-only log. In fact it uses the same tracker infrastructure as torrents.

By mirroring the two, it becomes easy to make CouchDB databases P2P, or to leverage CouchDB's query system to index and explore P2P datasets.

## Install

Use [NPM](https://www.npmjs.com/):

```bash
$ npm i @garbados/pouchdb-hypercore
```

## Docs

The plugin adds or modifies the following methods of PouchDB instances:

### `setHypercore(hypercore)`

Sets a hypercore to mirror database changes to and from. The hypercore must be writable. For non-writable feeds, use `followHypercore`.

```javascript
const pouch = new PouchDB(...)
pouch.setHypercore(hypercore)
```

### `followHypercore(hypercore)`

Streams changes from a hypercore into the database. Does not write changes to the hypercore.

```javascript
const pouch = new PouchDB(...)
pouch.followHypercore(hypercore)
```

### `bulkDocs(...)`

By wrapping this method, database updates -- puts, posts, and deletes -- are intercepted so they can be written to the associated hypercore. This function will not work until `setHypercore` has been run.

### `destroy(...)`

When the database would be destroyed, any associated hypercores are closed. To destroy

### `hypercore`

A property for accessing the hypercore set with `setHypercore`.

### `hypercores`

An array of the hypercores being followed with `followHypercore`.

### `hyperstream`

A readable stream of updates from the hypercore set with `setHypercore`. Used to map changes to the database.

### `hyperstreams`

An array of readable streams from hypercores set with `followHypercore`. Used to map changes to the database.

## Test

`npm test`

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
