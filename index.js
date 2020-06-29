const assert = require('assert').strict

// helper for handling cb-or-promise function signatures
function cbify (promise, callback) {
  return !callback ? promise : promise.then((result) => {
    return callback(null, result || [])
  }).catch((error) => {
    return callback(error)
  })
}

module.exports = function (PouchDB) {
  // save originals
  const bulkDocs = PouchDB.prototype.bulkDocs
  const destroy = PouchDB.prototype.destroy
  // setup hypercore follower, helper
  PouchDB.prototype._followHypercore = function (hypercore) {
    const hyperstream = hypercore.createReadStream({
      live: true,
      snapshot: false
    })
    hyperstream.on('data', async (updateString) => {
      const update = JSON.parse(updateString)
      try {
        // if doc exists, skip update
        await this.get(update._id, { rev: update._rev })
      } catch (error) {
        if (error.status === 404) {
          await this.bulkDocs([update])
        } else {
          throw error
        }
      }
    })
    return hyperstream
  }
  // TODO close hyperstreams on .close and .destroy
  // setup, writable core
  PouchDB.prototype.setHypercore = function (hypercore) {
    assert(hypercore, 'You must provide a Hypercore instance.')
    assert(hypercore.writable, 'Hypercore must be writable. Use `followHypercore` to only read from a hypercore.')
    this.hypercore = hypercore
    this.hyperstream = this._followHypercore(hypercore)
  }
  // TODO import from hypercore
  PouchDB.prototype.followHypercore = function (hypercore) {
    assert(hypercore, 'You must provide a Hypercore instance.')
    if (!this.hypercores) { this.hypercores = [] }
    if (!this.hyperstreams) { this.hyperstreams = [] }
    this.hypercores.push(hypercore)
    const hyperstream = this._followHypercore(hypercore)
    this.hyperstreams.push(hyperstream)
  }
  // intercept db updates to write to hypercore
  PouchDB.prototype.bulkDocs = async function (docs, opts = {}, callback) {
    assert(this.hypercore, 'You must run `.setHypercore` before PouchDB can sync with a hypercore.')
    const promise = bulkDocs.call(this, docs, opts).then(async (results) => {
      const ids = results.map(({ id }) => { return id }).filter((id) => {
        const d = ((docs && docs.docs) || docs)
        return d.map(({ _id }) => { return _id }).includes(id)
      })
      for (const id of ids) {
        const doc = await this.get(id)
        await new Promise((resolve, reject) => {
          this.hypercore.append(JSON.stringify(doc), (err) => {
            if (err) { reject(err) } else { resolve() }
          })
        })
      }
    })
    return cbify(promise, callback)
  }
  // close all streams when you destroy the db
  PouchDB.prototype.destroy = async function (opts = {}, callback) {
    const destroyPromise = destroy.call(this, opts)
    const streamPromises = [
      this.hyperstream || undefined,
      ...this.hyperstreams || []
    ].map((hyperstream) => {
      if (!hyperstream) { return Promise.resolve() }
      hyperstream.destroy()
      return new Promise((resolve) => {
        hyperstream.on('close', resolve)
      })
    })
    const promise = Promise.all([destroyPromise, ...streamPromises])
    return cbify(promise, callback)
  }
}
