/* global describe, it, before, after */

const assert = require('assert').strict
const fs = require('fs')
const PouchDB = require('pouchdb')
const Hypercore = require('hypercore')
const PouchHypercore = require('.')

const TEST_POUCH = '.testpouch'
const TEST_HYPER = '.testhyper'

describe('pouchdb-hypercore', function () {
  before(async function () {
    // set up pouchdb
    PouchDB.plugin(PouchHypercore)
    this.pouch = new PouchDB(TEST_POUCH)
    // set up hypercore
    this.hyper = Hypercore(TEST_HYPER)
    await new Promise((resolve) => { this.hyper.ready(resolve) })
    // set up read-only hypercores
    this.hypercores = []
    for (let i = 0; i < 3; i++) {
      const hypercore = Hypercore(`${TEST_HYPER}-${i}`)
      await new Promise((resolve) => { hypercore.ready(resolve) })
      this.hypercores.push(hypercore)
    }
    // set up pouchdb-hypercore
    this.pouch.setHypercore(this.hyper)
    for (const hypercore of this.hypercores) {
      this.pouch.followHypercore(hypercore)
    }
  })

  after(async function () {
    async function _destroyHyper (hypercore) {
      await new Promise((resolve, reject) => {
        hypercore.destroyStorage((err) => {
          if (err) {
            if (err.code === 'ENOENT') {
              // already missing
              resolve()
            } else {
              reject(err)
            }
          } else {
            resolve()
          }
        })
      })
    }
    // destroy pouchdb, readable streams
    await this.pouch.destroy()
    // destroy hypercore
    await _destroyHyper(this.hyper)
    fs.rmdirSync(TEST_HYPER)
    // destroy hypercores
    for (let i = 0; i < 3; i++) {
      const hypercore = this.hypercores[i]
      await _destroyHyper(hypercore)
      fs.rmdirSync(`${TEST_HYPER}-${i}`)
    }
  })

  it('should work', function () {
    // assert that pouchdb-hypercore is set up
    assert(this.pouch.hypercore.readable)
  })

  it('should write updates to the hypercore', async function () {
    await this.pouch.put({ _id: 'hello' })
    const id = await new Promise((resolve, reject) => {
      this.hyper.get(0, { wait: true }, (err, id) => {
        if (err) { reject(err) } else { resolve(id) }
      })
    })
    const doc = JSON.parse(id.toString('utf8'))
    assert.equal(doc._id, 'hello')
  })

  it('should follow updates to the hypercore', async function () {
    await new Promise((resolve, reject) => {
      this.hyper.append(JSON.stringify({ _id: 'goodbye' }), (err) => {
        if (err) { reject(err) } else { resolve() }
      })
    })
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    const doc = await this.pouch.get('goodbye')
    assert.equal(doc._id, 'goodbye')
  })

  it('should follow updates to read-only cores', async function () {
    this.timeout(0)
    for (let i = 0; i < 3; i++) {
      const hypercore = this.hypercores[i]
      // write
      await new Promise((resolve, reject) => {
        hypercore.append(JSON.stringify({ _id: `${i}` }), (err) => {
          if (err) { reject(err) } else { resolve() }
        })
      })
    }
    // wait
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    // verify
    const allDocs = await this.pouch.allDocs({ keys: ['0', '1', '2'] })
    assert.equal(allDocs.rows.length, 3)
    for (const doc of allDocs.rows) {
      assert.equal(doc.error, undefined)
    }
  })
})
