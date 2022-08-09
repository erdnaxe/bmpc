'use strict'
/* global prompt, HTMLAnchorElement, HTMLDivElement, HTMLLinkElement */

export default class QueuePanel {
  constructor (mpdClient, refreshStatus, refreshCurrentSong, notify, errorHandler) {
    this.mpdClient = mpdClient
    this.errorHandler = errorHandler
    this.queueElement = document.getElementById('queue')

    // Pagination
    this.queuePage = 0
    this.queueMaxPage = 0
    this.activeSongPos = -1
    this.songsPerPage = 25

    // Define event callbacks
    this.gotRemove = (event) => {
      const row = event.currentTarget.parentNode.parentNode
      this.mpdClient.delete(row.dataset.trackPos).then(() => this.refreshQueue()).then(refreshStatus).catch(errorHandler)
    }

    // Register events
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
    document.getElementById('page-indicator').addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        if (e.deltaY > 0 && this.queuePage < this.queueMaxPage) {
          this.queuePage += 1
        } else if (e.deltaY < 0 && this.queuePage > 0) {
          this.queuePage -= 1
        }
        this.refreshQueue()
      }
    })
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT') {
        switch (e.key) {
          case '/':
            document.getElementById('filter-queue').select()
            e.preventDefault()
            break
          case 'f':
            if (e.ctrlKey) {
              document.getElementById('filter-queue').select()
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
            if (this.queuePage < this.queueMaxPage) {
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
    const trackPos = data.song?.toString() ?? '-1'
    this.activeSongPos = trackPos
    this.queueMaxPage = Math.ceil(data.playlistlength / this.songsPerPage) - 1
    this.queueElement.childNodes.forEach((el) => {
      if (el instanceof HTMLAnchorElement) {
        el.classList.toggle('active', el.dataset.trackPos === trackPos)
      }
    })

    // Keep update database button active until update ends
    document.getElementById('btn-update-database').classList.toggle('active', data.updating_db || 0)

    // Make sure page count is updated
    document.getElementById('page-indicator').textContent = `${this.queuePage + 1} / ${this.queueMaxPage + 1}`
  }

  /**
   * Jump to currently playing page
   */
  async jumpToPlayingPage () {
    // Go to current page
    const playingPage = Math.max(Math.floor(this.activeSongPos / this.songsPerPage), 0)
    if (this.queueMaxPage >= 0) {
      this.queuePage = playingPage
      await this.refreshQueue()
    }
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

      // Column: track name
      const trackEl = document.createElement('div')
      trackEl.innerHTML = `${song.Title || song.Name || song.file}`
      trackEl.title = `${song.Title || song.Name || song.file}`
      item.appendChild(trackEl)

      // Column: artist
      const artistEl = document.createElement('div')
      artistEl.innerHTML = `${song.Artist || ''}`
      artistEl.title = `${song.Artist || ''}`
      item.appendChild(artistEl)

      // Column: album
      const albumEl = document.createElement('div')
      albumEl.classList.add('hide-sm')
      let albumDescription = `${song.Album || ''}`
      if (albumDescription && song.Date) {
        const unixTime = Date.parse(song.Date)
        const year = new Date(unixTime).getFullYear()
        albumDescription += `, ${year}`
      }
      if (albumDescription && song.Disc && song.Track) {
        albumDescription += `, disc ${song.Disc}, track ${song.Track}`
      } else if (song.Track) {
        albumDescription += `, track ${song.Track}`
      }
      albumEl.innerHTML = albumDescription
      albumEl.title = albumDescription
      item.appendChild(albumEl)

      // Column: duration
      const durationEl = document.createElement('div')
      durationEl.textContent = song.Time ? new Date(song.Time * 1000).toISOString().substring(14, 19) : '-'
      item.appendChild(durationEl)

      // Add remove track button
      const removeEl = document.createElement('span')
      removeEl.innerHTML = ' ✕'
      durationEl.appendChild(removeEl)

      this.queueElement.appendChild(item)
      if (song.Pos === this.activeSongPos) {
        item.classList.add('active') // Style current song
      }

      // Remove track on remove button click
      removeEl.addEventListener('click', this.gotRemove)
    }

    // Show pagination
    document.getElementById('btn-previous-page').disabled = this.queuePage <= 0
    document.getElementById('page-indicator').textContent = `${this.queuePage + 1} / ${this.queueMaxPage + 1}`
    document.getElementById('btn-next-page').disabled = data.length < this.songsPerPage
  }
}
