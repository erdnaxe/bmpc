package main

import (
	"embed"
	"flag"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"

	"golang.org/x/net/websocket"
)

var mpdAddress string

//go:embed static
var staticFiles embed.FS

func mpdToWsCopyWorker(src io.Reader, dst *websocket.Conn, done chan<- bool) {
	buf := make([]byte, 16*1024)
	for {
		// Use websocket.Message.Send to send as binary message
		nr, err_read := src.Read(buf)
		err_write := websocket.Message.Send(dst, buf[0:nr])
		if err_read != nil || err_write != nil {
			break
		}
	}
	done <- true
}

func wsToMpdCopyWorker(src io.Reader, dst io.Writer, done chan<- bool) {
	buf := make([]byte, 16*1024)
	for {
		nr, err_read := src.Read(buf)
		_, err_write := dst.Write(buf[0:nr])
		if err_read != nil || err_write != nil {
			break
		}
	}
	done <- true
}

func relayHandler(ws *websocket.Conn) {
	// Connect to MPD server
	conn, err := net.Dial("tcp", mpdAddress)
	if err != nil {
		log.Println(err)
		return
	}

	// Launch copy workers and wait for 2 done signals if exiting
	done := make(chan bool)
	go mpdToWsCopyWorker(conn, ws, done)
	go wsToMpdCopyWorker(ws, conn, done)
	<-done
	conn.Close()
	ws.Close()
	<-done
}

func main() {
	listenAddress := ""
	certFile := ""
	keyFile := ""

	// Read command line arguments
	flag.StringVar(&mpdAddress, "mpd-addr", "127.0.0.1:6600", "MPD server address")
	flag.StringVar(&listenAddress, "listen-addr", "127.0.0.1:8080", "Listen on this address")
	flag.StringVar(&certFile, "tls-cert", "", "TLS certificate file path (skip to disable TLS)")
	flag.StringVar(&keyFile, "tls-key", "", "TLS key file path (skip to disable TLS)")
	flag.Parse()

	// Create filesystem with static files
	staticFilesystem, err := fs.Sub(staticFiles, "static")
	if err != nil {
		panic(err)
	}

	// Configure router
	http.Handle("/ws", websocket.Handler(relayHandler))
	http.Handle("/", http.FileServer(http.FS(staticFilesystem)))

	// Start web server
	log.Printf("Listening on %s\n", listenAddress)
	if certFile != "" && keyFile != "" {
		log.Fatal(http.ListenAndServeTLS(listenAddress, certFile, keyFile, nil))
	} else {
		log.Fatal(http.ListenAndServe(listenAddress, nil))
	}
}
