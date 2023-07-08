#!/usr/bin/env node

/**
 * Module dependencies.
 */
import 'babel-polyfill';
import app from '../app';
import debugLib from 'debug';
import {createServer} from 'http';
const debug = debugLib('rap-clouds-node-server:server');
import { Server } from "socket.io";




/**
 * Get port from environment and store in Express.
*/

var port = normalizePort(process.env.PORT || '3333');
app.set('port', port);

/**
 * Create HTTP server.
*/

var server = createServer(app);

/** Connecting sockets to the server and adding them to the request
 * so that we can access them later in the controller
*/
const reactAppOrigin = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://www.rapclouds.com';

const io = new Server(server, {
	cors: {
	  origin: reactAppOrigin,
	}
  });
app.set('io', io);
io.on("connection", (socket) => {
	console.log("a user connected");
	// send a message to the client
	socket.emit("hello from server", 1, "2", { 3: Buffer.from([4]) });
	
	// receive a message from the client
	socket.on("hello from client", (...args) => {
		// ...
	});
});

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

server.timeout = 0;
/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
	var port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
	var addr = server.address();
	var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
	debug('Listening on ' + bind);
}
