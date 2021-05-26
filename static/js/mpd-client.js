'use strict'

/**
 * MPD client
 * Implement https://www.musicpd.org/doc/html/protocol.html
 * For idle mode, see https://docs.rs/mpd/0.0.12/mpd/idle/index.html
 */
export default class MpdClient {
  constructor () {
    this.socket = null

    // Events
    this.onQueue = null
    this.onStatus = null
    this.onCurrentSong = null

    // Dispatch idle events
    this.idleMessageHandler = (e) => {
      this.socket.onmessage = null // One shot event
      this.idle()

      // Parse response
      // We match MPD subsystems with the command one need to send to get update
      const pattern = /^\w+: (.+)$/gm
      for (const match of e.data.matchAll(pattern)) {
        switch (match[1]) {
          case 'playlist':
            this.onQueue()
            break
          case 'player':
            this.onStatus().then(() => this.onCurrentSong())
            break
          case 'mixer':
          case 'output':
          case 'options':
            this.onStatus()
            break
        }
      }
    }
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
            return
          }

          // Register callbacks and enter idle mode
          this.socket.onclose = this.onClose
          this.idle()
          resolve()
        }
      }
      this.socket.onerror = (e) => reject(e)
    })
  }

  /**
   * Send a request and return response as promise.
   * Set connection to `idle` after request to receive events.
   * @param {String} request Request to send to MPD.
   */
  async send (request) {
    await this.noIdle()
    return new Promise((resolve, reject) => {
      // Set temporary callback to catch response
      let response = ''
      this.socket.onmessage = (e) => {
        response += e.data

        if (e.data.endsWith('OK\n')) {
          this.idle() // Restore idle mode

          // Parse response
          const data = []
          const pattern = /^(\w+): (.+)$/gm
          for (const match of response.matchAll(pattern)) {
            data.push([match[1], match[2]])
          }
          resolve(data)
          return
        }

        if (e.data.startsWith('ACK ')) {
          this.idle() // Restore idle mode

          // Parse error
          const pattern_1 = /^ACK\s+\[.*\]\s+(\{.*)/
          const error = response.match(pattern_1)[1]
          reject(new Error(`Server error: ${error}`))
        }
      }
      this.socket.send(request)
    })
  }

  /**
   * Parse the raw list and format a list of songs.
   * @param {Array} dataList List returned by send promise.
   */
  songListParser (dataList) {
    const songList = []
    for (const entry of dataList) {
      // A new song always start with `file` entry
      if (entry[0] === 'file') {
        // New file section
        songList.push({})
      }

      if (songList.length > 0) {
        songList[songList.length - 1][entry[0]] = entry[1]
      }
    }
    return songList
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
   * Enter idle mode.
   * Connection enters idle state between each request.
   */
  idle () {
    if (!this.socket) {
      throw new Error('Not connected to server')
    }

    // Check we are not already idling
    if (this.socket.onmessage === this.idleMessageHandler) {
      return // Drop
    }

    // this.idleMessageHandler will be called when server will send an event
    this.socket.onmessage = this.idleMessageHandler
    this.socket.send('idle playlist player mixer output options\n')
  }

  /**
   * Exit idle mode.
   */
  noIdle () {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to server'))
        return
      }

      // Check we are in idle mode
      if (this.socket.onmessage !== this.idleMessageHandler) {
        return // Request already running, drop
      }

      // Set temporary callback to catch response
      this.socket.onmessage = (e) => {
        if (e.data.endsWith('OK\n')) {
          resolve()
        } else {
          reject(new Error('noidle failed'))
        }
      }

      this.socket.send('noidle\n')
    })
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
   * Displays server statistics.
   */
  async stats () {
    const data = await this.send('stats\n')

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
    if (typeof state === 'undefined' || state === null) {
      return this.send('pause\n')
    }
    return this.send(`pause ${state ? 1 : 0}\n`)
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
   * If prefixed by + or -, then the time is relative to the current position.
   * @param {String} time Position to seek in seconds.
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
   * Adds the file URI to the playlist (directories add recursively).
   * @param {String} uri URI to add.
   */
  add (uri) {
    return this.send(`add "${uri}"\n`)
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
    let data = null
    if (start !== null && end !== null) {
      data = await this.send(`playlistinfo ${start}:${end}\n`)
    } else {
      data = await this.send('playlistinfo\n')
    }

    // Parse playlist
    return this.songListParser(data)
  }

  /**
   * Searches case-insensitively for partial matches in the queue.
   * Search is escaped, see
   * <https://mpd.readthedocs.io/en/stable/protocol.html#escaping-string-values>
   * @param {String} filter Filter for searching, see
   * <https://www.musicpd.org/doc/html/protocol.html#filters>.
   */
  async playlistSearch (filter) {
    filter = filter.replace(/[^\w\d() ]/g, '\\$&') // Escape special characters
    const data = await this.send(`playlistsearch "${filter}"\n`)
    return this.songListParser(data)
  }

  /**
   * Saves the queue to NAME.m3u in the playlist directory.
   * @param {String} name Name of the playlist.
   */
  save (name) {
    return this.send(`save "${name}"\n`)
  }

  /**
   * Updates the music database: find new files, remove deleted files, update
   * modified files.
   */
  update () {
    return this.send('update\n')
  }

  /**
   * Reads a sticker value for the specified object.
   * @param {String} type Object type (“song” for song objects).
   * @param {String} uri Path within the database.
   * @param {String} name Name of sticker.
   */
  async stickerGet (type, uri, name) {
    const stickers = await this.send(`sticker get "${type}" "${uri}" "${name}"\n`)
    return stickers[0][1].split('=')[1]
  }

  /**
   * Adds a sticker value to the specified object.
   * If a sticker item with that name already exists, it is replaced.
   * @param {String} type Object type (“song” for song objects).
   * @param {String} uri Path within the database.
   * @param {String} name Name of sticker.
   * @param {String} value Value of sticker.
   */
  stickerSet (type, uri, name, value) {
    return this.send(`sticker set "${type}" "${uri}" "${name}" "${value}"\n`)
  }

  /**
   * Lists the stickers for the specified object.
   * @param {String} type Object type (“song” for song objects).
   * @param {String} uri Path within the database.
   */
  stickerList (type, uri) {
    return this.send(`sticker list "${type}" "${uri}"\n`)
  }

  /**
   * This is used for authentication with the server.
   * @param {String} password Password used to log in.
   */
  password (password) {
    return this.send(`password "${password}"\n`)
  }
}
