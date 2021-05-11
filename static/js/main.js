import MpdClient from "./mpd-client.js"
import sortable from "./html5sortable.es.min.js"
import Favicon from "./favicon.js"

// Create MPD client
const mpdClient = new MpdClient()

// Create favicon
const favicon = new Favicon()

// Pagination
let queuePage = 0
const songsPerPage = 100

// Notification system
function notify (text) {
  const notification = document.createElement("div")
  notification.textContent = text
  notification.classList.add("notification")
  document.body.appendChild(notification)
  setTimeout(() => {
    document.body.removeChild(notification)
  }, 3000)
}

// Login prompt shown when user has not enough privileges
function loginPrompt () {
  const loginBox = document.createElement("div")
  loginBox.textContent = "Please enter password: "
  loginBox.classList.add("notification")
  const passwordInput = document.createElement("input")
  passwordInput.type = "password"
  passwordInput.addEventListener("keyup", e => {
    if (e.key === "Enter") {
      document.body.removeChild(loginBox)
      mpdClient.password(passwordInput.value).then(() => {
        notify("Successfully logged in.")
      }).catch(errorHandler)
    }
  })
  loginBox.appendChild(passwordInput)
  document.body.appendChild(loginBox)
}

// Inspect error and prompt login if it is a permission error
function errorHandler (err) {
  if (err.message.includes("you don't have permission for")) {
    loginPrompt()
  } else {
    notify(err.message)
  }
}

async function refreshCurrentSong () {
  const data = await mpdClient.currentSong()
  document.getElementById("currenttrack").textContent = data.Title || data.Name || data.file
  document.getElementById("currenttrack").title = data.file
  document.getElementById("album").textContent = data.Album || "Unknown"
  document.getElementById("artist").textContent = data.Artist || "Unknown"

  // If track is remote, show download button
  const remotePattern = /^https?:\/\//i
  const btnDownload = document.getElementById("btn-download")
  btnDownload.classList.toggle("hide", !remotePattern.test(data.file))
  btnDownload.href = data.file

  // Update media session
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: data.Title || data.Name || data.file,
      artist: data.Artist || "",
      album: data.Album || ""
    })
  }
}

async function refreshStatus () {
  const data = await mpdClient.status()

  // Update play/pause buttons
  document.getElementById("btn-set-play").classList.toggle("hide", data.state === "play")
  document.getElementById("btn-set-pause").classList.toggle("hide", data.state !== "play")
  if (data.state === "play") {
    favicon.updateIcon("▶️")
  } else {
    favicon.updateIcon("⏸️")
  }

  // Update progress bar
  if (data.elapsed !== undefined && data.duration !== undefined) {
    document.getElementById("progress-bar").value = data.elapsed
    document.getElementById("progress-bar").max = data.duration
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

  // Style active song in bold in playlist
  const oldActive = document.getElementById("playlist").dataset.activeSong
  document.getElementById("playlist").dataset.activeSong = data.song
  if (oldActive) {
    document.querySelectorAll(`#playlist > tbody > tr[data-track-id="${oldActive}"]`).forEach(el => {
      el.classList.remove("active")
    })
  }
  document.querySelectorAll(`#playlist > tbody > tr[data-track-id="${data.song}"]`).forEach(el => {
    el.classList.add("active")
  })

  // Keep update database button active until update ends
  document.getElementById("btn-update-database").classList.toggle("active", data.updating_db || 0)

  // Update media session
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = (data.state === "play") ? "playing" : "paused"
  }
}

async function refreshQueue () {
  const filter = document.getElementById("filter-queue").value
  let data = []
  if (filter.length > 2) {
    // Get filtered queue
    data = await mpdClient.playlistSearch(`(any contains '${filter}')`).catch(errorHandler)

    // Crop to `songsPerPage` elements
    data = data.slice(0, songsPerPage)
  } else {
    // Get non filtered queue
    const start = queuePage * songsPerPage
    const end = (queuePage + 1) * songsPerPage
    data = await mpdClient.playlistInfo(start, end)
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
      mpdClient.delete(song.Pos).then(refreshQueue).then(refreshStatus)
    })

    // On click, jump to track
    row.addEventListener("click", () => {
      mpdClient.play(song.Pos).then(refreshStatus).then(refreshCurrentSong)
    })
  }

  // Show pagination
  document.getElementById("btn-previous-page").classList.toggle("hide", queuePage <= 0)
  document.getElementById("btn-next-page").classList.toggle("hide", data.length < songsPerPage)

  // Make queue table sortable
  sortable(newTableBody)[0].addEventListener("sortupdate", (e) => {
    const from = queuePage * songsPerPage + e.detail.origin.index
    const to = queuePage * songsPerPage + e.detail.destination.index
    mpdClient.move(from, to).then(refreshQueue)
  })
}

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
document.getElementById("btn-add-stream").addEventListener("click", (e) => {
  const uri = prompt("Stream URL")
  if (uri) {
    mpdClient.add(uri).then(refreshQueue).catch(errorHandler)
  }
  e.preventDefault()
})
document.getElementById("btn-rm-all").addEventListener("click", (e) => {
  mpdClient.clear().then(refreshQueue).catch(errorHandler)
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
  refreshQueue()
})
document.getElementById("btn-previous-page").addEventListener("click", (e) => {
  queuePage--
  history.pushState({ queuePage }, "")
  refreshQueue()
  e.preventDefault()
})
document.getElementById("btn-next-page").addEventListener("click", (e) => {
  queuePage++
  history.pushState({ queuePage }, "")
  refreshQueue()
  e.preventDefault()
})
document.addEventListener("keydown", (e) => {
  if (e.target.tagName !== "INPUT") {
    switch (e.key) {
    case " ":
      mpdClient.pause().then(refreshStatus).catch(errorHandler)
      e.preventDefault()
      break
    case "f":
      if (e.ctrlKey) {
        document.getElementById("filter-queue").focus()
        e.preventDefault()
      }
      break
    case "ArrowLeft":
      if (queuePage > 0) {
        if (e.shiftKey) {
          queuePage = 0
        } else {
          queuePage--
        }
        history.pushState({ queuePage }, "")
        refreshQueue()
        e.preventDefault()
      }
      break
    case "ArrowRight":
      // TODO: get track count in playlist and implement Shift+RightArrow
      if (document.querySelector("#playlist > tbody").childElementCount >= songsPerPage) {
        queuePage++
        history.pushState({ queuePage }, "")
        refreshQueue()
        e.preventDefault()
      }
      break
    }
  }
})

mpdClient.onClose = () => {
  notify("Connection to server lost, retrying in 3 seconds")
  setTimeout(() => mpdClient.connect(), 3000)
}

// Configure media session actions
if ("mediaSession" in navigator) {
  // Play blank audio to take audio focus and allow media control
  const audio = new Audio("/blank.ogg")
  audio.loop = false
  audio.play()

  navigator.mediaSession.setActionHandler("play", () => {
    mpdClient.pause(0).then(refreshStatus)
  })
  navigator.mediaSession.setActionHandler("pause", () => {
    mpdClient.pause(1).then(refreshStatus)
  })
  navigator.mediaSession.setActionHandler("stop", () => {
    mpdClient.stop().then(refreshStatus)
  })
  navigator.mediaSession.setActionHandler("seekbackward", e => {
    if (e.seekOffset) {
      mpdClient.seekCursor(e.seekOffset).then(refreshStatus)
    } else {
      mpdClient.seekCursor("-5").then(refreshStatus)
    }
  })
  navigator.mediaSession.setActionHandler("seekforward", e => {
    if (e.seekOffset) {
      mpdClient.seekCursor(e.seekOffset).then(refreshStatus)
    } else {
      mpdClient.seekCursor("+5").then(refreshStatus)
    }
  })
  navigator.mediaSession.setActionHandler("seekto", e => {
    mpdClient.seekCursor(e.seekTime).then(refreshStatus)
  })
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    mpdClient.previous().then(refreshStatus).then(refreshCurrentSong)
  })
  navigator.mediaSession.setActionHandler("nexttrack", () => {
    mpdClient.next().then(refreshStatus).then(refreshCurrentSong)
  })
}

// Configure history
window.onpopstate = (event) => {
  // Queue page history
  if (event.state.queuePage && event.state.queuePage !== queuePage) {
    queuePage = event.state.queuePage
    refreshQueue()
  }
}

mpdClient.connect().then(() => {
  // Automatically refresh
  // These are useful when another MPD client is changing state.
  // When tab is not focused, the browser will slow down these.
  // TODO: Use `idle` feature from MPD.
  setInterval(refreshCurrentSong, 5000)
  setInterval(refreshStatus, 1000)
  setInterval(refreshQueue, 5000)

  // Initial refresh
  refreshCurrentSong().then(refreshStatus).then(refreshQueue)
}).catch(errorHandler)
