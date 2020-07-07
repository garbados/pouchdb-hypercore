module.exports = {
  fromHypercore: async function (hypercore, opts = {}) {
    if (!this._hypercores) { this._hypercores = [] }
    this._hypercores.push(hypercore)
    await new Promise((resolve) => { hypercore.ready(resolve) })
    const key = hypercore.key.toString('hex')
    hypercore.on('append', async () => {
      const seq = hypercore.length - 1
      const message = await new Promise((resolve, reject) => {
        hypercore.head({ wait: true, valueEncoding: 'json' }, (err, data) => {
          if (err) { reject(err) } else { resolve(data) }
        })
      })
      await this.bulkDocs([{
        _id: `${key}@${seq}`,
        '.key': key,
        '.seq': seq,
        ...message
      }])
    })
  },
  fromMultifeed: async function (multifeed, opts = {}) {
    if (!this._multifeeds) { this._multifeeds = [] }
    this._multifeeds.push(multifeed)
    await new Promise((resolve) => { multifeed.ready(resolve) })
    const fromHypercore = async (feed) => { await this.fromHypercore(feed, opts) }
    const promises = multifeed.feeds().map(fromHypercore)
    multifeed.on('feed', fromHypercore)
    return Promise.all(promises)
  }
}
