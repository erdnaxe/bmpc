import Favicon from "./component/Favicon.js"
import MediaSession from "./component/MediaSession.js"
import MpdClient from "./mpd-client.js"
import PlayerControl from "./component/PlayerControl.js"
import QueuePanel from "./component/QueuePanel.js"

// Init client and components
const mpdClient = new MpdClient()
const favicon = new Favicon()
const playerControl = new PlayerControl(mpdClient, refreshStatus, refreshCurrentSong, errorHandler)
const queuePanel = new QueuePanel(mpdClient, notify, errorHandler)
const mediaSession = new MediaSession(mpdClient, refreshStatus, refreshCurrentSong, errorHandler)

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
  if (document.getElementById("login-prompt")) {
    return // Already exist
  }
  const loginBox = document.createElement("div")
  loginBox.id = "login-prompt"
  loginBox.textContent = "Please enter password: "
  loginBox.classList.add("notification")
  const passwordInput = document.createElement("input")
  passwordInput.type = "password"
  passwordInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      document.body.removeChild(loginBox)
      mpdClient.password(passwordInput.value).then(() => {
        notify("Successfully logged in.")
      }).catch(errorHandler)
    }
  })
  loginBox.appendChild(passwordInput)
  document.body.appendChild(loginBox)
  passwordInput.focus()
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
  const data = await mpdClient.currentSong().catch(errorHandler)
  playerControl.updateCurrentSong(data)
  mediaSession.updateCurrentSong(data)
}

async function refreshStatus () {
  const data = await mpdClient.status().catch(errorHandler)
  playerControl.updateStatus(data)
  mediaSession.updateStatus(data)
  queuePanel.updateStatus(data)

  // Update favicon
  if (data.state === "play") {
    favicon.updateIcon("▶️")
  } else {
    favicon.updateIcon("⏸️")
  }
}

mpdClient.onClose = () => {
  notify("Connection to server lost, retrying in 3 seconds")
  setTimeout(() => mpdClient.connect(), 3000)
}

mpdClient.connect().then(() => {
  // Automatically refresh
  // These are useful when another MPD client is changing state.
  // When tab is not focused, the browser will slow down these.
  // TODO: Use `idle` feature from MPD.
  setInterval(() => {
    refreshCurrentSong().then(refreshStatus).then(() => queuePanel.refreshQueue())
  }, 1000)

  // Initial refresh
  refreshCurrentSong().then(refreshStatus).then(() => queuePanel.refreshQueue())
}).catch(errorHandler)
