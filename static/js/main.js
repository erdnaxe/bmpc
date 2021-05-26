'use strict'

import Favicon from './component/Favicon.js'
import MediaSession from './component/MediaSession.js'
import MpdClient from './mpd-client.js'
import PlayerPanel from './component/PlayerPanel.js'
import QueuePanel from './component/QueuePanel.js'

// Init client and components
const mpdClient = new MpdClient()
const favicon = new Favicon()
const playerPanel = new PlayerPanel(mpdClient, refreshStatus, refreshCurrentSong, refreshOutput, errorHandler)
const queuePanel = new QueuePanel(mpdClient, refreshStatus, refreshCurrentSong, notify, errorHandler)
const mediaSession = new MediaSession(mpdClient, refreshStatus, refreshCurrentSong, errorHandler)

// Notification system
function notify (text) {
  const notification = document.createElement('div')
  notification.textContent = text
  notification.classList.add('notification')
  document.body.appendChild(notification)
  setTimeout(() => {
    document.body.removeChild(notification)
  }, 3000)
}

// Login prompt shown when user has not enough privileges
function loginPrompt () {
  if (document.getElementById('login-prompt')) {
    return // Already exist
  }
  const loginBox = document.createElement('div')
  loginBox.id = 'login-prompt'
  loginBox.textContent = 'Please enter password: '
  loginBox.classList.add('notification')
  const passwordInput = document.createElement('input')
  passwordInput.type = 'password'
  passwordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      document.body.removeChild(loginBox)
      mpdClient.password(passwordInput.value).then(() => {
        notify('Successfully logged in.')
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
  playerPanel.updateCurrentSong(data)
  mediaSession.updateCurrentSong(data)
  document.title = `${data.Title || data.Name || data.file} — ` +
    `${data.Album || 'Unknown'} — ${data.Artist || 'Unknown'} | bmpc`
}

async function refreshStatus () {
  const data = await mpdClient.status().catch(errorHandler)
  playerPanel.updateStatus(data)
  mediaSession.updateStatus(data)
  queuePanel.updateStatus(data)

  // Update favicon
  if (data.state === 'play') {
    favicon.updateIcon('▶️')
  } else {
    favicon.updateIcon('⏸️')
  }
}

async function refreshOutput () {
  const data = await mpdClient.outputs().catch(errorHandler)
  playerPanel.updateOutput(data)
}

function periodicRefresh () {
  if (document.visibilityState === 'visible') {
    // TODO: increment time without request to server
    refreshStatus()
    setTimeout(periodicRefresh, 1000)
  } else {
    // Wait for focus to save resources when running in background
    document.addEventListener('visibilitychange', periodicRefresh, { once: true })
  }
}

mpdClient.onClose = () => {
  notify('Connection to server lost, retrying in 3 seconds')
  setTimeout(() => mpdClient.connect(), 3000)
}
mpdClient.onQueue = () => queuePanel.refreshQueue()
mpdClient.onStatus = () => refreshStatus()
mpdClient.onCurrentSong = () => refreshCurrentSong()
mpdClient.onOutput = () => refreshOutput()

mpdClient.connect().then(() => {
  // Initial refresh then set up periodic refresh
  refreshCurrentSong().then(refreshStatus).then(refreshOutput).then(() => {
    queuePanel.refreshQueue()
  }).then(() => {
    periodicRefresh()
  })
}).catch(errorHandler)
