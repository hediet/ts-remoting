import * as io from "socket.io";
import { Message, MessageStream, StreamChannel, getProxy, ClassInstanceObjectInfo, remotable, ChannelListener, RemotingServer } from "hediet-remoting";
import { Promise as Task } from "hediet-framework/dist/Promises";

export class ServerSocketIOStream implements MessageStream {

	private unreadMessages: Message[] = [];
	private onMessageCallback: ((readMessage: Message) => void) | undefined;

	constructor(public readonly socket: SocketIO.Socket) {
		socket.on("message", (message: Message) => this.onMessage(message));
	}

	private onMessage(message: Message) {
		if (this.onMessageCallback)
			this.onMessageCallback(message);
		else
			this.unreadMessages.push(message);
	}

	public setReadCallback(callback: ((readMessage: Message) => void) | undefined) {
		this.onMessageCallback = callback;
		
		if (!callback) return;

		while (this.unreadMessages.length > 0) {
			const msg = this.unreadMessages.shift()!;
			callback(msg);
		}
	}

	public write(message: Message): PromiseLike<void> {
		this.socket.send(message);
		return Task.resolve();
	}
}

export class SocketIOServer {
	private readonly server: SocketIO.Server;

	constructor(port: number, private readonly onConnectCallback: (stream: MessageStream, socket: SocketIO.Socket) => void) {
		this.server = io(port);
		this.server.on("connection", (socket) => {
			const stream = new ServerSocketIOStream(socket);
			onConnectCallback(stream, socket);
		});
	}
}
