# bmpc

<img src="static/favicon.svg" align="right" width="64px"/>

bmpc is a web-based MPD client focused on simplicity and ease of use.
It is also intended as a proof-of-concept of a WebSocket MPD client
(https://github.com/MusicPlayerDaemon/MPD/issues/1511).

Some features:

-   Simple installation thanks to Golang.
-   Free and open source: this project is under the MIT license.
-   Hackable: no NodeJS tool required to build, use modern
    [ECMAScript 2017](https://en.wikipedia.org/wiki/ECMAScript#8th_Edition_%E2%80%93_ECMAScript_2017)
    code for readability.

## Installation

bmpc requires a
[MPD](https://en.wikipedia.org/wiki/Music_Player_Daemon)-compatible music server
as it is only a client.

bmpc needs to be installed on a machine that can access MPD socket.

### Using Golang

You can use `go install` to download and compile bmpc directly.
The output binary is usually in `~/go/bin/bmpc`.

```bash
go install github.com/erdnaxe/bmpc@latest
```

## How to contribute

Please check your code using [standardjs](https://standardjs.com/).
