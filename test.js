/* global describe, it, before, after */

const assert = require('assert').strict
const Hypercore = require('hypercore')
const multifeed = require('multifeed')
const PouchDB = require('pouchdb')
const PouchHypercore = require('.')
const rimraf = require('rimraf')

const TEST_POUCH = '.testpouch'
const TEST_HYPER = '.testhyper'
const TEST_MULTI = '.testmulti'

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
    // set up multicore
    this.multifeed = multifeed(TEST_MULTI)
    // set up pouchdb-hypercore
    for (const hypercore of [this.hyper, ...this.hypercores]) {
      this.pouch.fromHypercore(hypercore)
    }
    this.pouch.fromMultifeed(this.multifeed)
  })

  after(async function () {
    // destroy pouchdb, readable streams
    await this.pouch.destroy()
    // destroy hypercore
    rimraf.sync(TEST_HYPER)
    // destroy hypercores
    for (let i = 0; i < 3; i++) {
      rimraf.sync(`${TEST_HYPER}-${i}`)
    }
    // destroy multifeed
    await new Promise((resolve) => {
      this.multifeed.close(resolve)
    })
    rimraf.sync(TEST_MULTI)
  })

  it('should work', function () {
    // assert that pouchdb-hypercore is set up
    this.pouch._hypercores.forEach((feed) => {
      assert(feed.readable)
    })
  })

  it('should follow updates to the hypercore', async function () {
    const seq = await new Promise((resolve, reject) => {
      this.hyper.append(JSON.stringify({ hello: 'goodbye' }), function (err, seq) {
        if (err) { reject(err) } else { resolve(seq) }
      })
    })
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    const key = this.hyper.key.toString('hex')
    const doc = await this.pouch.get(`${key}@${seq}`)
    assert.equal(doc.hello, 'goodbye')
  })

  it('should follow updates to read-only cores', async function () {
    for (let i = 0; i < 3; i++) {
      const hypercore = this.hypercores[i]
      // write
      await new Promise((resolve, reject) => {
        hypercore.append(JSON.stringify({ i: `${i}` }), (err) => {
          if (err) { reject(err) } else { resolve() }
        })
      })
    }
    // wait
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    // verify
    const allDocs = await this.pouch.allDocs({ include_docs: true })
    const docs = allDocs.rows.filter(({ doc }) => {
      if (!doc.i) { return false }
      const i = parseInt(doc.i)
      return i < 3 && i >= 0
    })
    assert.equal(docs.length, 3)
  })

  it('should follow updates from multifeed feeds', async function () {
    const local = await new Promise((resolve, reject) => {
      this.multifeed.writer('local', (err, feed) => {
        return err ? reject(err) : resolve(feed)
      })
    })
    const key = local.key.toString('hex')
    const seq = await new Promise((resolve, reject) => {
      local.append(JSON.stringify({ hello: 'goodbye' }), function (err, seq) {
        if (err) { reject(err) } else { resolve(seq) }
      })
    })
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    const doc = await this.pouch.get(`${key}@${seq}`)
    assert.equal(doc.hello, 'goodbye')
  })
})
