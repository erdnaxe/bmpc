/**
 * Implement https://www.musicpd.org/doc/html/protocol.html
 */
export default class MpdClient {
  constructor () {
    this.socket = null
    this.onClose = null

    // Lock during request
    this.lock = false
  }

  /**
   * Connect to MPD.
   */
  connect () {
    return new Promise((resolve, reject) => {
      const protocol = `ws${location.protocol === 'https:' ? 's' : ''}:`
      this.socket = new WebSocket(`${protocol}//${location.host}/ws`)
      this.socket.onopen = () => {
        // Wait for OK from server
        this.socket.onmessage = (msg) => {
          if (!msg.data.startsWith('OK MPD ')) {
            reject(new Error('Bad return code from server'))
          }

          // Register onclose callback
          this.socket.onclose = this.onClose

          resolve()
        }
      }
      this.socket.onerror = (e) => reject(e)
    })
  }

  /**
   * Send a request and return response as promise.
   * @param {String} request Request to send to MPD.
   */
  async send (request) {
    // Wait and acquire lock
    await new Promise(resolve => {
      const inter = setInterval(() => {
        if (!this.lock) {
          clearInterval(inter)
          resolve()
        }
      }, 50)
    })
    this.lock = true

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to server'))
      }

      // Set temporary callback to catch response
      let response = ''
      this.socket.onmessage = (msg) => {
        response += msg.data

        if (msg.data.endsWith('OK\n')) {
          // Release lock
          this.lock = false

          // Parse response
          const data = []
          const pattern = /^(\w+): (.+)$/gm
          for (const match of response.matchAll(pattern)) {
            data.push([match[1], match[2]])
          }
          resolve(data)
        }

        if (msg.data.startsWith('ACK ')) {
          // Release lock
          this.lock = false

          // Parse error
          const pattern = /^ACK\s+\[.*\]\s+(\{.*)/
          const error = response.match(pattern)[1]
          reject(new Error(`Server error: ${error}`))
        }
      }

      this.socket.send(request)
    })
  }

  /**
   * Reports the current status of the player and the volume level.
   */
  async currentSong () {
    const data = await this.send('currentsong\n')

    // Parse status
    const status = {}
    for (const entry of data) {
      if (isNaN(entry[1])) {
        status[entry[0]] = entry[1]
      } else {
        status[entry[0]] = parseInt(entry[1])
      }
    }
    return status
  }

  /**
   * Reports the current status of the player and the volume level.
   */
  async status () {
    const data = await this.send('status\n')

    // Parse status
    const status = {}
    for (const entry of data) {
      if (isNaN(entry[1])) {
        status[entry[0]] = entry[1]
      } else {
        status[entry[0]] = parseInt(entry[1])
      }
    }
    return status
  }

  /**
   * When consume is activated, each song played is removed from playlist.
   * @param {Boolean} state True to active, false to deactivate.
   */
  setConsume (state) {
    return this.send(`consume ${state ? 1 : 0}\n`)
  }

  /**
   * Sets crossfading between songs.
   * @param {Number} seconds Number of seconds of crossfading
   */
  setCrossfade (seconds) {
    return this.send(`crossfade ${seconds}\n`)
  }

  /**
   * Sets random state.
   * @param {Boolean} state True to active, false to deactivate
   */
  setRandom (state) {
    return this.send(`random ${state ? 1 : 0}\n`)
  }

  /**
   * Sets repeat state.
   * @param {Boolean} state True to active, false to deactivate
   */
  setRepeat (state) {
    return this.send(`repeat ${state ? 1 : 0}\n`)
  }

  /**
   * Set volume.
   * @param {Number} vol Volume between 0 and 100
   */
  setVolume (vol) {
    return this.send(`setvol ${vol}\n`)
  }

  /**
   * Stop playback after current song, or repeat it if ‘repeat’ mode is enabled.
   * @param {Boolean} state True to active, false to deactivate.
   */
  setSingle (state) {
    return this.send(`single ${state ? 1 : 0}\n`)
  }

  /**
   * Plays next song in the playlist.
   */
  next () {
    return this.send('next\n')
  }

  /**
   * Pause or resume playback.
   * @param {Boolean} state True to pause playback or false to resume playback,
   * null to toggle.
   */
  pause (state) {
    if (state === null) {
      return this.send('pause\n')
    } else {
      return this.send(`pause ${state ? 1 : 0}\n`)
    }
  }

  /**
   * Begins playing the playlist at song.
   * @param {Number} songPos Identifier of the song to play.
   */
  play (songPos) {
    return this.send(`play ${songPos}\n`)
  }

  /**
   * Plays previous song in the playlist.
   */
  previous () {
    return this.send('previous\n')
  }

  /**
   * Seeks to the position.
   * @param {Number} time Position to seek in seconds.
   */
  seekCursor (time) {
    return this.send(`seekcur ${time}\n`)
  }

  /**
   * Stops playing.
   */
  stop () {
    return this.send('stop\n')
  }

  /**
   * Clears the queue.
   */
  clear () {
    return this.send('clear\n')
  }

  /**
   * Deletes a song from the playlist.
   * @param {Number} pos Position of song to remove.
   */
  delete (pos) {
    return this.send(`delete ${pos}\n`)
  }

  /**
   * Deletes a range of songs from the playlist.
   * @param {Number} start Start of range.
   * @param {Number} end End of range (not included).
   */
  deleteRange (start, end) {
    return this.send(`delete ${start}:${end}\n`)
  }

  /**
   * Moves the song in the playlist.
   * @param {Number} from Initial position.
   * @param {Number} to Destination.
   */
  move (from, to) {
    return this.send(`move ${from} ${to}\n`)
  }

  /**
   * Displays a list of all songs in the playlist, optionally in the range.
   * @param {Number} start Start of range.
   * @param {Number} end End of range (not included).
   */
  async playlistInfo (start, end) {
    let data
    if (start !== null && end !== null) {
      data = await this.send(`playlistinfo ${start}:${end}\n`)
    } else {
      data = await this.send('playlistinfo\n')
    }

    // Parse playlist
    const playlist = []
    for (const entry of data) {
      // A new song always start with `file` entry
      if (entry[0] === 'file') {
        // New file section
        playlist.push({})
      }

      if (playlist.length > 0) {
        playlist[playlist.length - 1][entry[0]] = entry[1]
      }
    }
    return playlist
  }

  /**
   * Updates the music database: find new files, remove deleted files, update
   * modified files.
   */
  update () {
    return this.send('update\n')
  }
}
