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

function refreshCurrentSong () {
  mpdClient.currentSong().then((data) => {
    document.getElementById("currenttrack").textContent = data.Title
    document.getElementById("album").textContent = data.Album || ""
    document.getElementById("artist").textContent = data.Artist || ""

    // Update media session
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: data.Title,
        artist: data.Artist || "",
        album: data.Album || ""
      })
    }
  })
}

function refreshStatus () {
  mpdClient.status().then((data) => {
    // Update play/pause buttons
    document.getElementById("btn-set-play").classList.toggle("hide", data.state === "play")
    document.getElementById("btn-set-pause").classList.toggle("hide", data.state !== "play")
    if (data.state === "play") {
      favicon.updateIcon("▶️")
    } else {
      favicon.updateIcon("⏸️")
    }

    // Update progress bar
    document.getElementById("progress-bar").value = data.elapsed
    document.getElementById("progress-bar").max = data.duration

    // Update progress counter
    const elapsed = new Date(data.elapsed * 1000).toISOString().substr(14, 5)
    const duration = new Date(data.duration * 1000).toISOString().substr(14, 5)
    document.getElementById("counter").textContent = `${elapsed} / ${duration}`

    // Update playback settings
    document.getElementById("btn-toggle-random").classList.toggle("active", data.random)
    document.getElementById("btn-toggle-repeat").classList.toggle("active", data.repeat)
    document.getElementById("btn-toggle-consume").classList.toggle("active", data.consume)
    document.getElementById("btn-toggle-single").classList.toggle("active", data.single)
    document.getElementById("btn-toggle-crossfade").classList.toggle("active", data.xfade > 0)

    // Update playlist
    document.querySelectorAll("#playlist > tbody > tr").forEach(el => {
      el.classList.toggle("active", parseInt(el.dataset.trackId) === data.song)
    })

    // Update media session
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = (data.state === "play") ? "playing" : "paused"
    }
  })
}

function refreshQueue () {
  const start = queuePage * songsPerPage
  const end = (queuePage + 1) * songsPerPage
  mpdClient.playlistInfo(start, end).then((data) => {
    // Create new table body
    const oldTableBody = document.querySelector("#playlist > tbody")
    const newTableBody = document.createElement("tbody")
    oldTableBody.parentNode.replaceChild(newTableBody, oldTableBody)

    // Fill table with playlist
    for (const song of data) {
      const time = new Date(song.Time * 1000).toISOString().substr(14, 5)
      const row = document.createElement("tr")
      row.dataset.trackId = song.Pos
      row.innerHTML = `<td>${parseInt(song.Pos) + 1}</td>` +
        `<td>${song.Artist}<br /><span>${song.Album}</span></td>` +
        `<td>${song.Title}</td><td>${time}</td>`
      const removeTd = document.createElement("td")
      removeTd.innerHTML = "✕"
      row.appendChild(removeTd)
      newTableBody.appendChild(row)

      // Remove track on remove button click
      removeTd.addEventListener("click", () => {
        newTableBody.removeChild(row)
        mpdClient.delete(song.Pos).then(() => refreshQueue()) // FIXME: bug, does not refresh and play
      })

      // On click, jump to track
      row.addEventListener("click", () => { mpdClient.play(song.Pos) })
    }

    // Show pagination
    document.getElementById("previous-page").classList.toggle("hide", queuePage <= 0)
    document.getElementById("next-page").classList.toggle("hide", data.length < songsPerPage)

    // Make queue table sortable
    sortable(newTableBody)[0].addEventListener("sortupdate", (e) => {
      const from = queuePage * songsPerPage + e.detail.origin.index
      const to = queuePage * songsPerPage + e.detail.destination.index
      mpdClient.move(from, to).then(() => refreshQueue())
    })
  })
}

// Register events
document.getElementById("progress-bar").addEventListener("input", (e) => {
  mpdClient.seekCursor(e.target.value).catch((e) => notify(e.message))
})
document.getElementById("btn-set-prev").addEventListener("click", (e) => {
  mpdClient.previous().catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-set-play").addEventListener("click", (e) => {
  mpdClient.pause(0).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-set-pause").addEventListener("click", (e) => {
  mpdClient.pause(1).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-set-next").addEventListener("click", (e) => {
  mpdClient.next().catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-toggle-random").addEventListener("click", (e) => {
  const active = e.target.classList.contains("active")
  mpdClient.setRandom(!active).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-toggle-repeat").addEventListener("click", (e) => {
  const active = e.target.classList.contains("active")
  mpdClient.setRepeat(!active).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-toggle-consume").addEventListener("click", (e) => {
  const active = e.target.classList.contains("active")
  mpdClient.setConsume(!active).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-toggle-single").addEventListener("click", (e) => {
  const active = e.target.classList.contains("active")
  mpdClient.setSingle(!active).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-toggle-crossfade").addEventListener("click", (e) => {
  const state = e.target.classList.contains("active")
  mpdClient.setCrossfade(state ? 0 : 3).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-add-stream").addEventListener("click", (e) => {
  const url = prompt("Stream URL")
  if (url) {
    // FIXME: mpdClient.addTrack(url).catch((e) => notify(e.message))
  }
  e.preventDefault()
})
document.getElementById("btn-rm-all").addEventListener("click", (e) => {
  // FIXME: mpdClient.rmAll().catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("btn-save-queue").addEventListener("click", (e) => {
  const name = prompt("New playlist name")
  if (name) {
    // FIXME: mpdClient.saveQueue(name).catch((e) => notify(e.message))
  }
  e.preventDefault()
})
document.getElementById("btn-update-database").addEventListener("click", (e) => {
  mpdClient.update().then(() => {
    notify("Updating MPD database")
  }).catch((e) => notify(e.message))
  e.preventDefault()
})
document.getElementById("previous-page").addEventListener("click", (e) => {
  history.pushState({ queuePage }, "")
  queuePage--
  refreshQueue()
  e.preventDefault()
})
document.getElementById("next-page").addEventListener("click", (e) => {
  history.pushState({ queuePage }, "")
  queuePage++
  refreshQueue()
  e.preventDefault()
})
document.addEventListener("keydown", (e) => {
  if (!e.repeat && e.target.tagName !== "INPUT") {
    switch (e.key) {
    case " ":
      mpdClient.pause().catch((e) => notify(e.message))
      e.preventDefault()
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

  navigator.mediaSession.setActionHandler("play", () => mpdClient.pause(0))
  navigator.mediaSession.setActionHandler("pause", () => mpdClient.pause(1))
  navigator.mediaSession.setActionHandler("stop", () => mpdClient.stop())
  navigator.mediaSession.setActionHandler("previoustrack", () => mpdClient.previous())
  navigator.mediaSession.setActionHandler("nexttrack", () => mpdClient.next())
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
  refreshQueue()
  setInterval(refreshStatus, 1000)
  setInterval(refreshCurrentSong, 1000)
}).catch((e) => notify(e.message))
