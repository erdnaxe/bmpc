"use strict"

export default class PlayerPanel {
  constructor (mpdClient, refreshStatus, refreshCurrentSong, errorHandler) {
    // Register events
    document.getElementById("progress-bar").addEventListener("input", (e) => {
      mpdClient.seekCursor(e.target.value).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById("btn-set-prev").addEventListener("click", (e) => {
      mpdClient.previous().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-set-play").addEventListener("click", (e) => {
      mpdClient.pause(0).then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-set-pause").addEventListener("click", (e) => {
      mpdClient.pause(1).then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-set-next").addEventListener("click", (e) => {
      mpdClient.next().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-toggle-random").addEventListener("click", (e) => {
      const active = e.target.classList.contains("active")
      mpdClient.setRandom(!active).then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-toggle-repeat").addEventListener("click", (e) => {
      const active = e.target.classList.contains("active")
      mpdClient.setRepeat(!active).then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-toggle-consume").addEventListener("click", (e) => {
      const active = e.target.classList.contains("active")
      mpdClient.setConsume(!active).then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-toggle-single").addEventListener("click", (e) => {
      const active = e.target.classList.contains("active")
      mpdClient.setSingle(!active).then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.getElementById("btn-toggle-crossfade").addEventListener("click", (e) => {
      const state = e.target.classList.contains("active")
      mpdClient.setCrossfade(state ? 0 : 3).then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName !== "INPUT") {
        switch (e.key) {
        case " ":
          mpdClient.pause().then(refreshStatus).catch(errorHandler)
          e.preventDefault()
          break
        }
      }
    })
  }

  /**
   * Update element to reflect new current song
   * @param {Object} data Current song returned by MPD
   */
  updateCurrentSong (data) {
    // Format track and disk
    let trackDisk = ""
    if (data.Disc && data.Track) {
      trackDisk = `Disc ${data.Disc}, track ${data.Track}`
    } else if (data.Track) {
      trackDisk = `Track ${data.Track}`
    }

    // Update text elements
    document.getElementById("title").textContent = data.Title || data.Name || data.file
    document.getElementById("title").title = data.file
    document.getElementById("track-disk").textContent = trackDisk
    document.getElementById("album").textContent = data.Album || "Unknown"
    document.getElementById("artist").textContent = data.Artist || "Unknown"
  
    // If track is remote, show download button
    const remotePattern = /^https?:\/\//i
    const btnDownload = document.getElementById("btn-download")
    btnDownload.classList.toggle("hide", !remotePattern.test(data.file))
    btnDownload.href = data.file  
  }

  /**
   * Update element to reflect new status
   * @param {Object} data Status returned by MPD
   */
  updateStatus (data) {
    // Update play/pause buttons
    document.getElementById("btn-set-play").classList.toggle("hide", data.state === "play")
    document.getElementById("btn-set-pause").classList.toggle("hide", data.state !== "play")

    // Update progress bar
    if (data.elapsed !== undefined && data.duration !== undefined) {
      document.getElementById("progress-bar").max = data.duration
      document.getElementById("progress-bar").value = data.elapsed
    } else {
      document.getElementById("progress-bar").value = 0
    }

    // Update progress counter
    let elapsed = "-"
    let duration = "-"
    if (data.elapsed !== undefined) {
      elapsed = new Date(data.elapsed * 1000).toISOString().substr(14, 5)
    }
    if (data.duration !== undefined) {
      duration = new Date(data.duration * 1000).toISOString().substr(14, 5)
    }
    document.getElementById("counter").textContent = `${elapsed} / ${duration}`

    // Update playback settings
    document.getElementById("btn-toggle-random").classList.toggle("active", data.random)
    document.getElementById("btn-toggle-repeat").classList.toggle("active", data.repeat)
    document.getElementById("btn-toggle-consume").classList.toggle("active", data.consume)
    document.getElementById("btn-toggle-single").classList.toggle("active", data.single)
    document.getElementById("btn-toggle-crossfade").classList.toggle("active", data.xfade > 0)
  }
}
