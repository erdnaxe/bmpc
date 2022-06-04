'use strict'

import MediaSession from './component/MediaSession.js'
import MpdClient from './mpd-client.js'
import PlayerPanel from './component/PlayerPanel.js'
import QueuePanel from './component/QueuePanel.js'

// Init client and components
const mpdClient = new MpdClient()
const playerPanel = new PlayerPanel(mpdClient, refreshStatus, refreshCurrentSong, refreshOutput, errorHandler)
const queuePanel = new QueuePanel(mpdClient, refreshStatus, refreshCurrentSong, notify, errorHandler)
const mediaSession = new MediaSession(mpdClient, refreshStatus, refreshCurrentSong, errorHandler)

// Store current server song position for hashchange event
let currentlyPlayingId = ''

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
    `${data.Album || 'Unknown'} — ${data.Artist || 'Unknown'}`
  currentlyPlayingId = `${data.Id}`
  window.location.hash = `#${data.Id}`

  // Update cover art
  const coverArtImg = document.getElementById('cover-art')
  if (data.file) {
    const picture = await mpdClient.readPicture(data.file)
    coverArtImg.classList.toggle('hide', picture === null)
    if (picture !== null) {
      const imageURL = URL.createObjectURL(picture)
      URL.revokeObjectURL(coverArtImg.src)
      coverArtImg.src = imageURL
    }
  } else {
    coverArtImg.classList.add('hide')
  }
}

async function refreshStatus () {
  const data = await mpdClient.status().catch(errorHandler)
  const replayGainData = await mpdClient.replayGainStatus().catch(errorHandler)
  playerPanel.updateStatus(data, replayGainData)
  mediaSession.updateStatus(data)
  queuePanel.updateStatus(data)
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

// When URL changes, change song
window.addEventListener('hashchange', () => {
  const songId = window.location.hash.substring(1)
  if (!isNaN(songId) && currentlyPlayingId !== songId) {
    mpdClient.playId(songId).then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
  }
})

mpdClient.onClose = () => {
  notify('Connection to server lost, retrying in 3 seconds')
  setTimeout(() => mpdClient.connect().catch(errorHandler), 3000)
}
mpdClient.onQueue = () => queuePanel.refreshQueue()
mpdClient.onStatus = () => refreshStatus()
mpdClient.onCurrentSong = () => refreshCurrentSong()
mpdClient.onOutput = () => refreshOutput()

mpdClient.connect().then(() => {
  // Initial refresh then set up periodic refresh
  refreshCurrentSong().then(refreshStatus).then(refreshOutput).then(() => {
    queuePanel.jumpToPlayingPage()
  }).then(() => {
    periodicRefresh()
  })
}).catch(errorHandler)
