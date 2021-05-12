"use strict"

export default class MediaSession {
  constructor (mpdClient, refreshStatus, refreshCurrentSong, errorHandler) {
    // Configure media session actions
    if ("mediaSession" in navigator) {
      // Play blank audio to take audio focus and allow media control
      const audio = new Audio("/blank.ogg")
      audio.loop = false
      audio.play()

      navigator.mediaSession.setActionHandler("play", () => {
        mpdClient.pause(0).then(refreshStatus).catch(errorHandler)
      })
      navigator.mediaSession.setActionHandler("pause", () => {
        mpdClient.pause(1).then(refreshStatus).catch(errorHandler)
      })
      navigator.mediaSession.setActionHandler("stop", () => {
        mpdClient.stop().then(refreshStatus).catch(errorHandler)
      })
      navigator.mediaSession.setActionHandler("seekbackward", (e) => {
        if (e.seekOffset) {
          mpdClient.seekCursor(e.seekOffset).then(refreshStatus).catch(errorHandler)
        } else {
          mpdClient.seekCursor("-5").then(refreshStatus).catch(errorHandler)
        }
      })
      navigator.mediaSession.setActionHandler("seekforward", (e) => {
        if (e.seekOffset) {
          mpdClient.seekCursor(e.seekOffset).then(refreshStatus).catch(errorHandler)
        } else {
          mpdClient.seekCursor("+5").then(refreshStatus).catch(errorHandler)
        }
      })
      navigator.mediaSession.setActionHandler("seekto", (e) => {
        mpdClient.seekCursor(e.seekTime).then(refreshStatus).catch(errorHandler)
      })
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        mpdClient.previous().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
      })
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        mpdClient.next().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
      })
    }
  }

  /**
   * Update element to reflect new current song
   * @param {Object} data Current song returned by MPD
   */
  updateCurrentSong (data) {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: data.Title || data.Name || data.file,
        artist: data.Artist || "",
        album: data.Album || ""
      })
    }  
  }

  /**
   * Update element to reflect new status
   * @param {Object} data Status returned by MPD
   */
  updateStatus (data) {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = data.state === "play" ? "playing" : "paused"
    }
  }
}
