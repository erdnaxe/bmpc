import sortable from "../html5sortable.es.min.js"

export default class QueuePanel {
  constructor (mpdClient, notify, errorHandler) {
    this.mpdClient = mpdClient
    this.errorHandler = errorHandler

    // Pagination
    this.queuePage = 0
    this.songsPerPage = 100

    // Register events
    document.getElementById("btn-add-stream").addEventListener("click", (e) => {
      const uri = prompt("Stream URL")
      if (uri) {
        mpdClient.add(uri).then(this.refreshQueue).catch(errorHandler)
      }
      e.preventDefault()
    })
    document.getElementById("btn-rm-all").addEventListener("click", (e) => {
      mpdClient.clear().then(this.refreshQueue).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-save-queue").addEventListener("click", (e) => {
      const name = prompt("New playlist name")
      if (name) {
        mpdClient.save(name).catch(errorHandler)
      }
      e.preventDefault()
    })
    document.getElementById("btn-update-database").addEventListener("click", (e) => {
      mpdClient.update().then(() => {
        notify("Updating MPD database")
      }).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("filter-queue").addEventListener("input", () => {
      this.refreshQueue()
    })
    document.getElementById("btn-previous-page").addEventListener("click", (e) => {
      this.queuePage--
      history.pushState({ queuePage: this.queuePage }, "")
      this.refreshQueue()
      e.preventDefault()
    })
    document.getElementById("btn-next-page").addEventListener("click", (e) => {
      this.queuePage++
      history.pushState({ queuePage: this.queuePage }, "")
      this.refreshQueue()
      e.preventDefault()
    })
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName !== "INPUT") {
        switch (e.key) {
        case "f":
          if (e.ctrlKey) {
            document.getElementById("filter-queue").focus()
            e.preventDefault()
          }
          break
        case "ArrowLeft":
          if (this.queuePage > 0) {
            if (e.shiftKey) {
              this.queuePage = 0
            } else {
              this.queuePage--
            }
            history.pushState({ queuePage: this.queuePage }, "")
            this.refreshQueue()
            e.preventDefault()
          }
          break
        case "ArrowRight":
          // TODO: get track count in playlist and implement Shift+RightArrow
          if (document.querySelector("#playlist > tbody").childElementCount >= this.songsPerPage) {
            this.queuePage++
            history.pushState({ queuePage: this.queuePage }, "")
            this.refreshQueue()
            e.preventDefault()
          }
          break
        }
      }
    })

    // Configure history
    window.onpopstate = (event) => {
      // Queue page history
      if (event.state.queuePage && event.state.queuePage !== this.queuePage) {
        this.queuePage = event.state.queuePage
        this.refreshQueue()
      }
    }
  }

  /**
   * Update element to reflect new status
   * @param {Object} data Status returned by MPD
   */
  updateStatus (data) {
    // Style active song in bold in playlist
    const oldActive = document.getElementById("playlist").dataset.activeSong
    document.getElementById("playlist").dataset.activeSong = data.song
    if (oldActive) {
      document.querySelectorAll(`#playlist > tbody > tr[data-track-id="${oldActive}"]`).forEach((el) => {
        el.classList.remove("active")
      })
    }
    document.querySelectorAll(`#playlist > tbody > tr[data-track-id="${data.song}"]`).forEach((el) => {
      el.classList.add("active")
    })

    // Keep update database button active until update ends
    document.getElementById("btn-update-database").classList.toggle("active", data.updating_db || 0)
  }

  /**
   * Refresh queue
   */
  async refreshQueue () {
    const filter = document.getElementById("filter-queue").value
    let data = []
    if (filter.length > 2) {
      // Get filtered queue
      data = await this.mpdClient.playlistSearch(`(any contains '${filter}')`).catch(this.errorHandler)
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
  
    // Create new table body
    const oldTableBody = document.querySelector("#playlist > tbody")
    const newTableBody = document.createElement("tbody")
    oldTableBody.parentNode.replaceChild(newTableBody, oldTableBody)

    // Fill table with playlist
    const activeSong = document.getElementById("playlist").dataset.activeSong
    for (const song of data) {
    // Format metadata
      let time = "-"
      if (song.Time !== undefined) {
        time = new Date(song.Time * 1000).toISOString().substr(14, 5)
      }
      let trackDescription = ""
      if (song.Disc && song.Track) {
        trackDescription = `Disc ${song.Disc}, track ${song.Track}`
      } else if (song.Track) {
        trackDescription = `Track ${song.Track}`
      }
      let albumDescription = `${song.Album || ""}`
      if (song.Date) {
        const year = new Date(song.Date).getFullYear()
        albumDescription += ` (${year})`
      }

      // Create table row
      const row = document.createElement("tr")
      row.dataset.trackId = song.Pos
      row.innerHTML = `<td>${parseInt(song.Pos) + 1}</td>` +
      `<td>${song.Artist || ""}<i>${albumDescription}</i></td>` +
      `<td>${song.Title || song.Name || song.file}<i>${trackDescription}</i></td><td>${time}</td>`
      row.title = song.file
      const removeTd = document.createElement("td")
      removeTd.innerHTML = "✕"
      row.appendChild(removeTd)
      newTableBody.appendChild(row)
      if (song.Pos === activeSong) {
      // Style current song
        row.classList.add("active")
      }

      // Remove track on remove button click
      removeTd.addEventListener("click", () => {
        newTableBody.removeChild(row)
        this.mpdClient.delete(song.Pos).then(this.refreshQueue).then(this.refreshStatus).catch(this.errorHandler)
      })

      // On click, jump to track
      row.addEventListener("click", () => {
        this.mpdClient.play(song.Pos).then(this.refreshStatus).then(this.refreshCurrentSong).catch(this.errorHandler)
      })
    }

    // Show pagination
    document.getElementById("btn-previous-page").classList.toggle("hide", this.queuePage <= 0)
    document.getElementById("btn-next-page").classList.toggle("hide", data.length < this.songsPerPage)

    // Make queue table sortable
    sortable(newTableBody)[0].addEventListener("sortupdate", (e) => {
      const from = this.queuePage * this.songsPerPage + e.detail.origin.index
      const to = this.queuePage * this.songsPerPage + e.detail.destination.index
      this.mpdClient.move(from, to).then(this.refreshQueue).catch(this.errorHandler)
    })
  }
}
