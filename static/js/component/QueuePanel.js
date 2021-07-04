'use strict'

export default class QueuePanel {
  constructor (mpdClient, refreshStatus, refreshCurrentSong, notify, errorHandler) {
    this.mpdClient = mpdClient
    this.errorHandler = errorHandler
    this.queueElement = document.getElementById('queue')

    // Pagination
    this.queuePage = 0
    this.songsPerPage = 25

    // Define event callbacks
    this.gotRemove = (event) => {
      const row = event.currentTarget.parentNode
      this.mpdClient.delete(row.dataset.trackPos).then(() => this.refreshQueue()).then(refreshStatus).catch(errorHandler)
    }

    // Register events
    document.getElementById('btn-queue-collapse').addEventListener('click', (e) => {
      document.getElementById('queue-control').classList.toggle('hide')
      this.queueElement.classList.toggle('hide')
      e.preventDefault()
    })
    document.getElementById('btn-add-stream').addEventListener('click', (e) => {
      const uri = prompt('Stream URL')
      if (uri) {
        mpdClient.add(uri).then(() => this.refreshQueue()).catch(errorHandler)
      }
      e.preventDefault()
    })
    document.getElementById('btn-rm-all').addEventListener('click', (e) => {
      mpdClient.clear().then(() => this.refreshQueue()).then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById('btn-save-queue').addEventListener('click', (e) => {
      const name = prompt('New playlist name')
      if (name) {
        mpdClient.save(name).catch(errorHandler)
      }
      e.preventDefault()
    })
    document.getElementById('btn-update-database').addEventListener('click', (e) => {
      mpdClient.update().then(() => {
        notify('Updating MPD database')
      }).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById('filter-queue').addEventListener('input', () => {
      this.refreshQueue()
    })
    document.getElementById('btn-previous-page').addEventListener('click', (e) => {
      this.queuePage--
      this.refreshQueue()
      e.preventDefault()
    })
    document.getElementById('btn-next-page').addEventListener('click', (e) => {
      this.queuePage++
      this.refreshQueue()
      e.preventDefault()
    })
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT') {
        switch (e.key) {
          case 'f':
            if (e.ctrlKey) {
              document.getElementById('filter-queue').focus()
              e.preventDefault()
            }
            break
          case 's':
            if (e.ctrlKey) {
              const name = prompt('New playlist name')
              if (name) {
                mpdClient.save(name).catch(errorHandler)
              }
              e.preventDefault()
            }
            break
          case 'ArrowLeft':
            if (this.queuePage > 0) {
              this.queuePage--
              this.refreshQueue()
              e.preventDefault()
            }
            break
          case 'ArrowRight':
            if (this.queueElement.childElementCount >= this.songsPerPage) {
              this.queuePage++
              this.refreshQueue()
              e.preventDefault()
            }
            break
        }
      }
    })
  }

  /**
   * Update element to reflect new status
   * @param {Object} data Status returned by MPD
   */
  updateStatus (data) {
    // Style active song in bold in playlist
    this.queueElement.dataset.activeSong = data.song === undefined ? -1 : data.song
    const trackPos = this.queueElement.dataset.activeSong.toString()
    this.queueElement.childNodes.forEach((el) => {
      if (el instanceof HTMLAnchorElement) {
        el.classList.toggle('active', el.dataset.trackPos === trackPos)
      }
    })

    // Keep update database button active until update ends
    document.getElementById('btn-update-database').classList.toggle('active', data.updating_db || 0)
  }

  /**
   * Refresh queue
   */
  async refreshQueue () {
    // Collect queue data
    let filter = document.getElementById('filter-queue').value
    let data = []
    if (filter.length > 2) {
      // Get filtered queue
      filter = filter.replace(/[^\w\d() ]/g, '\\$&') // Escape
      data = await this.mpdClient.playlistSearch(`(any contains "${filter}")`).catch(this.errorHandler)
      if (!data) {
        return
      }

      // Crop to `songsPerPage` elements
      data = data.slice(0, this.songsPerPage)
    } else {
      // Get non filtered queue
      const start = this.queuePage * this.songsPerPage
      const end = (this.queuePage + 1) * this.songsPerPage
      data = await this.mpdClient.playlistInfo(start, end).catch(this.errorHandler)
    }

    // Empty queue except title
    while (this.queueElement.lastChild && !(this.queueElement.lastChild instanceof HTMLDivElement)) {
      if (this.queueElement.lastChild instanceof HTMLLinkElement) {
        // Clear events before removing for garbage collection
        this.queueElement.lastChild.lastChild.removeEventListener('click', this.gotRemove)
      }
      this.queueElement.removeChild(this.queueElement.lastChild)
    }

    // Fill queue
    for (const song of data) {
      // Create table row
      const item = document.createElement('a')
      item.classList.add('queue-item')
      item.href = `#${song.Id}`
      item.dataset.trackPos = song.Pos
      item.title = song.file

      // Column: track number
      const numberEl = document.createElement('div')
      numberEl.textContent = parseInt(song.Pos) + 1
      item.appendChild(numberEl)

      // Column: artist, album
      const artistEl = document.createElement('div')
      let albumDescription = `${song.Album || ''}`
      if (song.Date) {
        const year = new Date(song.Date).getFullYear()
        albumDescription += ` (${year})`
      }
      artistEl.innerHTML = `${song.Artist || ''}<i>${albumDescription}</i>`
      item.appendChild(artistEl)

      // Column: track
      const trackEl = document.createElement('div')
      let trackDescription = ''
      if (song.Disc && song.Track) {
        trackDescription = `Disc ${song.Disc}, track ${song.Track}`
      } else if (song.Track) {
        trackDescription = `Track ${song.Track}`
      }
      trackEl.innerHTML = `${song.Title || song.Name || song.file}<i>${trackDescription}</i>`
      item.appendChild(trackEl)

      // Column: duration
      const durationEl = document.createElement('div')
      durationEl.textContent = song.Time ? new Date(song.Time * 1000).toISOString().substr(14, 5) : '-'
      item.appendChild(durationEl)

      // Last column: remove element
      const removeEl = document.createElement('div')
      removeEl.innerHTML = '✕'
      item.appendChild(removeEl)

      this.queueElement.appendChild(item)
      if (song.Pos === this.queueElement.dataset.activeSong) {
        item.classList.add('active') // Style current song
      }

      // Remove track on remove button click
      removeEl.addEventListener('click', this.gotRemove)
    }

    // Show pagination
    document.getElementById('btn-previous-page').classList.toggle('hide', this.queuePage <= 0)
    document.getElementById('btn-next-page').classList.toggle('hide', data.length < this.songsPerPage)
  }
}
