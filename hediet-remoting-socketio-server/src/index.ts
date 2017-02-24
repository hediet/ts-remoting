import * as io from "socket.io";
import http = require("http");
import { Message, MessageStream, BaseMessageStream } from "hediet-remoting";

export class ServerSocketIOStream extends BaseMessageStream {
	constructor(public readonly socket: SocketIO.Socket) {
		super();
		socket.on("message", (message: Message) => this.onMessage(message));
		socket.on("disconnect", () => this.resolveClosedPromise());
	}

	public write(message: Message): PromiseLike<void> {
		this.socket.send(message);
		return Promise.resolve();
	}

	public toString(): string {
		return `server-socket-io@${this.socket.client.conn.remoteAddress}`;
	}
}

export type OnConnectCallbackType = (stream: MessageStream, socket: SocketIO.Socket) => void;

export class SocketIOServer {
	private readonly server: SocketIO.Server;

	constructor(port: number, private readonly onConnectCallback: OnConnectCallbackType, opts: { host?: string } = {}) {
		const server = http.createServer();
		server.listen(port, opts.host);

		this.server = io(server);
		this.server.on("connection", (socket) => {
			const stream = new ServerSocketIOStream(socket);
			onConnectCallback(stream, socket);
		});
	}

	public dispose() {
		this.server.close();
	}
}
