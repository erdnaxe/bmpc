'use strict'

export default class PlayerPanel {
  constructor (mpdClient, refreshStatus, refreshCurrentSong, refreshOutput, errorHandler) {
    this.songLength = 100 // in seconds, default to maximum of range element

    // Event called for output buttons
    this.toggleOutput = (e) => {
      mpdClient.toggleOutput(e.target.dataset.outputId).then(refreshOutput)
    }

    // Register events
    document.getElementById('progress-bar').addEventListener('input', (e) => {
      mpdClient.seekCursor(e.target.value).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('btn-set-prev').addEventListener('click', (e) => {
      mpdClient.previous().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
    })
    document.getElementById('btn-set-play').addEventListener('click', (e) => {
      mpdClient.pause(0).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('btn-set-pause').addEventListener('click', (e) => {
      mpdClient.pause(1).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('btn-set-next').addEventListener('click', (e) => {
      mpdClient.next().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
    })
    document.getElementById('btn-toggle-random').addEventListener('click', (e) => {
      const active = e.target.classList.contains('active')
      mpdClient.setRandom(!active).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('btn-toggle-repeat').addEventListener('click', (e) => {
      const active = e.target.classList.contains('active')
      if (active) {
        mpdClient.setSingle(true).then(refreshStatus).catch(errorHandler)
      } else {
        mpdClient.setRepeat(true).then(refreshStatus).catch(errorHandler)
      }
    })
    document.getElementById('btn-toggle-repeat-single').addEventListener('click', (e) => {
      mpdClient.setSingle(false).then(() => mpdClient.setRepeat(false)).then(() => mpdClient.setConsume(true)).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('btn-toggle-consume').addEventListener('click', (e) => {
      mpdClient.setConsume(false).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('btn-toggle-crossfade').addEventListener('click', (e) => {
      const state = e.target.classList.contains('active')
      mpdClient.setCrossfade(state ? 0 : 3).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('volume-slider').addEventListener('input', (e) => {
      mpdClient.setVolume(e.target.value).then(refreshStatus).catch(errorHandler)
    })
    document.getElementById('btn-replay-gain').addEventListener('click', (e) => {
      const state = e.target.classList.contains('active')
      mpdClient.replayGainMode(state ? 'off' : 'auto').then(refreshStatus).catch(errorHandler)
      e.preventDefault()
    })
    document.addEventListener('keydown', (e) => {
      // Play pause using space bar and numpad seeking
      if (e.target.tagName !== 'INPUT' && !e.ctrlKey && !e.altKey) {
        let active = false
        let value = 0
        switch (e.code) {
          case 'Digit0':
          case 'Numpad0':
            mpdClient.seekCursor(0).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit1':
          case 'Numpad1':
            mpdClient.seekCursor(this.songLength * 0.1).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit2':
          case 'Numpad2':
            mpdClient.seekCursor(this.songLength * 0.2).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit3':
          case 'Numpad3':
            mpdClient.seekCursor(this.songLength * 0.3).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit4':
          case 'Numpad4':
            mpdClient.seekCursor(this.songLength * 0.4).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit5':
          case 'Numpad5':
            mpdClient.seekCursor(this.songLength * 0.5).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit6':
          case 'Numpad6':
            mpdClient.seekCursor(this.songLength * 0.6).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit7':
          case 'Numpad7':
            mpdClient.seekCursor(this.songLength * 0.7).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit8':
          case 'Numpad8':
            mpdClient.seekCursor(this.songLength * 0.8).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'Digit9':
          case 'Numpad9':
            mpdClient.seekCursor(this.songLength * 0.9).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
        }
        switch (e.key) {
          case 'p':
          case ' ':
            mpdClient.pause().then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case '<':
            mpdClient.previous().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
            e.preventDefault()
            return
          case '>':
            mpdClient.next().then(refreshStatus).then(refreshCurrentSong).catch(errorHandler)
            e.preventDefault()
            return
          case 'b':
            mpdClient.seekCursor('-2').then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'f':
            mpdClient.seekCursor('+2').then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'z':
            active = document.getElementById('btn-toggle-random').classList.contains('active')
            mpdClient.setRandom(!active).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'r':
            active = document.getElementById('btn-toggle-repeat').classList.contains('active')
            active &= document.getElementById('btn-toggle-repeat-single').classList.contains('hide')
            mpdClient.setSingle(false).then(() => mpdClient.setConsume(false)).then(() => mpdClient.setRepeat(!active)).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'y':
            active = !document.getElementById('btn-toggle-repeat-single').classList.contains('hide')
            mpdClient.setConsume(false).then(() => mpdClient.setRepeat(!active)).then(() => mpdClient.setSingle(!active)).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'R':
            active = !document.getElementById('btn-toggle-consume').classList.contains('hide')
            mpdClient.setSingle(false).then(() => mpdClient.setRepeat(false)).then(() => mpdClient.setConsume(!active)).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case 'x':
            active = document.getElementById('btn-toggle-crossfade').classList.contains('active')
            mpdClient.setCrossfade(active ? 0 : 3).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case '-':
            value = Math.max(Number(document.getElementById('volume-slider').value) - 2, 0)
            mpdClient.setVolume(value).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
            return
          case '+':
            value = Math.min(Number(document.getElementById('volume-slider').value) + 2, 100)
            mpdClient.setVolume(value).then(refreshStatus).catch(errorHandler)
            e.preventDefault()
        }
      }
    })
  }

  /**
   * Update element to reflect new current song
   * @param {Object} data Current song returned by MPD
   */
  updateCurrentSong (data) {
    if (document.getElementById('title').title === data.file) {
      return // Already up to date
    }

    // Format track and disk
    let trackDisk = ''
    if (data.Disc && data.Track) {
      trackDisk = `Disc ${data.Disc}, track ${data.Track}`
    } else if (data.Track) {
      trackDisk = `Track ${data.Track}`
    }

    // Update text elements
    document.getElementById('title').textContent = data.Title ?? data.Name ?? data.file
    document.getElementById('title').title = data.file
    document.getElementById('track-disk').textContent = trackDisk
    let albumDescription = data.Album ?? 'Unknown'
    if (data.Date) {
      const year = new Date(data.Date).getFullYear()
      albumDescription += ` (${year})`
    }
    document.getElementById('album').textContent = albumDescription
    if (data.MUSICBRAINZ_ALBUMID) {
      document.getElementById('album').href = `https://musicbrainz.org/release/${data.MUSICBRAINZ_ALBUMID}`
    } else {
      document.getElementById('album').removeAttribute('href')
    }
    document.getElementById('artist').textContent = data.Artist || 'Unknown'
    if (data.MUSICBRAINZ_ARTISTID) {
      document.getElementById('artist').href = `https://musicbrainz.org/artist/${data.MUSICBRAINZ_ARTISTID}`
    } else {
      document.getElementById('artist').removeAttribute('href')
    }

    // If track is remote, show download button
    const remotePattern = /^https?:\/\//i
    const btnDownload = document.getElementById('btn-download')
    btnDownload.classList.toggle('hide', !remotePattern.test(data.file))
    btnDownload.href = data.file
  }

  /**
   * Update element to reflect new status
   * @param {Object} data Status returned by MPD
   * @param {Object} replayGainData Replay gain status returned by MPD
   */
  updateStatus (data, replayGainData) {
    // Update play/pause buttons
    document.getElementById('btn-set-play').classList.toggle('hide', data.state === 'play')
    document.getElementById('btn-set-pause').classList.toggle('hide', data.state !== 'play')

    // Update progress bar
    document.getElementById('progress-bar').max = data.duration ?? 100
    document.getElementById('progress-bar').value = data.elapsed ?? 0
    this.songLength = data.duration ?? 100

    // Update progress counter
    let elapsed = '-'
    let duration = '-'
    if (data.elapsed !== undefined) {
      elapsed = new Date(data.elapsed * 1000).toISOString().substr(14, 5)
    }
    if (data.duration !== undefined) {
      duration = new Date(data.duration * 1000).toISOString().substr(14, 5)
    }
    document.getElementById('counter').textContent = `${elapsed} / ${duration}`

    // Update volume slider
    document.getElementById('btn-volume').classList.toggle('hide', data.volume === undefined)
    document.getElementById('volume-slider').value = data.volume ?? 100

    // Update playback settings
    document.getElementById('btn-toggle-random').classList.toggle('active', data.random)
    document.getElementById('btn-toggle-repeat').classList.toggle('active', data.repeat)
    document.getElementById('btn-toggle-repeat').classList.toggle('hide', data.consume || data.single)
    document.getElementById('btn-toggle-repeat-single').classList.toggle('hide', data.consume || !data.single)
    document.getElementById('btn-toggle-consume').classList.toggle('hide', !data.consume)
    document.getElementById('btn-toggle-crossfade').classList.toggle('active', data.xfade > 0)

    // Update replay gain mode
    document.getElementById('btn-replay-gain').classList.toggle('active', replayGainData.replay_gain_mode !== 'off')
  }

  /**
   * Update element to reflect new output state
   * @param {Object} data Outputs returned by MPD
   */
  updateOutput (data) {
    const outputElement = document.getElementById('output-group')

    // Empty output group
    while (outputElement.lastChild) {
      outputElement.lastChild.removeEventListener('click', this.toggleOutput)
      outputElement.removeChild(outputElement.lastChild)
    }

    // Build output elements and append
    for (const output of data) {
      const buttonEl = document.createElement('button')
      buttonEl.textContent = output.outputname || `Output ${output.outputid}`
      buttonEl.dataset.outputId = output.outputid
      buttonEl.addEventListener('click', this.toggleOutput)
      buttonEl.classList.toggle('active', output.outputenabled === '1')
      outputElement.appendChild(buttonEl)
    }
  }
}
