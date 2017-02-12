import * as io from "socket.io-client";
import { Message, MessageStream, StreamChannel, getProxy, remotable, ChannelListener, RemotingServer } from "hediet-remoting";

export class ClientSocketIOStream implements MessageStream {

	private unreadMessages: Message[] = [];
	private onMessageCallback: ((readMessage: Message) => void) | undefined;

	constructor(public readonly socket: SocketIOClient.Socket) {
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
		return Promise.resolve();
	}
}

export class SocketIOClient {
	public readonly stream: ClientSocketIOStream;

	constructor(uri: string) {
		const socket = io(uri);
		this.stream = new ClientSocketIOStream(socket);
	}
}
