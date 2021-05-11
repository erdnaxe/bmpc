# bmpc

bmpc is a web MPD client focused on simplicity and ease of use.

Some features:

-   Only require a [Music Player Daemon](https://en.wikipedia.org/wiki/Music_Player_Daemon)
    or [Mopidy](https://mopidy.com/) server.
-   Simple installation.
-   Free, open source: bmpc is under the MIT license.
-   Easily hackable: no NodeJS tool required to build, use modern
    [ECMAScript 2017](https://en.wikipedia.org/wiki/ECMAScript#8th_Edition_%E2%80%93_ECMAScript_2017)
    code for readability.
-   Media control support: integrate with MPRIS using Firefox on Linux,
    should also work on other platforms.
-   Color scheme support: light and dark mode.

## Installation

bmpc needs to be installed on a machine that can access MPD socket.

### Using Golang

You can use `go get` to download and compile bmpc.
You might need to add the `go/bin` folder to your `$PATH` afterward.

```bash
go get github.com/erdnaxe/bmpc
```

### Optimized build from source

To create a small static binary:

```bash
cd path/to/bmpc
go build -ldflags='-s -w'
upx --brute bmpc  # optional compression
```
