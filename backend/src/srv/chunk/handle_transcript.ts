

module.exports = function make_handle_transcript() {
  return async function handle_transcript(this: any, msg: any, meta: any) {
    const seneca = this
    const debug = seneca.shared.debug(meta.action)
    const { listPaths } = seneca.export('PodmindUtility/getUtils')()

    let out: any = { ok: false, why: '', path: '', paths: [], episode_id: null }

    let path = out.path = msg.path
    let episode_id = out.episode_id = msg.episode_id
    let doEmbed = out.doEmbed = false !== msg.doEmbed
    let doStore = out.doStore = false !== msg.doStore
    let mark = msg.mark || seneca.util.Nid()

    debug('TRANSCRIPT', 'no-batch', mark, path, episode_id, doEmbed, doStore)

    // AWS S3 event
    if (null == path && null == episode_id) {
      debug('RECORDS', 'no-batch', mark, path, episode_id, msg.event?.Records)

      const paths = listPaths(msg.event)

      if (paths && 0 < paths.length) {
        out.ok = true

        for (path of paths) {
          let pathres = await seneca.post('aim:chunk,handle:transcript', {
            path
          })

          out.paths.push({
            path,
            ...pathres,
          })
          out.ok = out.ok && pathres.ok
        }
      }

      return out
    }

    debug('TRANSCRIPT-SINGLE', 'no-batch', mark, path, episode_id, doEmbed, doStore)

    let batch = null

    if (null == episode_id) {
      let m = path.match(/folder01\/transcript01\/([^-]+)\/([^-]+)-([^-.]+)/)

      if (null == m) {
        out.why = 'filename-mismatch'
        return out
      }
      episode_id = m[2]
      batch = m[3]
    }

    let episodeEnt = await seneca.entity('pdm/episode').load$(episode_id)
    if (null === episodeEnt) {
      out.why = 'episode-not-found'
      debug('TRANSCRIPT-SINGLE-FAIL', batch, mark, path, episode_id, doEmbed, doStore, out)
      return out
    }

    let podcast_id = episodeEnt.podcast_id

    if (null == path) {
      path = `folder01\/transcript01/${podcast_id}/${episode_id}-${batch}-dg01.json`
    }

    debug('TRANSCRIPT-CHUNK', batch, mark, path, podcast_id, episode_id, doEmbed, doStore)

    out = await seneca.post('aim:chunk,whence:upload,chunk:transcript', {
      path,
      podcast_id,
      episode_id,
      doEmbed,
      doStore,
    })

    return out
  }
}



