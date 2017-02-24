import * as io from "socket.io-client";
import { Message, BaseMessageStream, StreamChannel, RemotingServer, Channel, createProxy, ServiceInfo, ServiceReflector, DecoratedServiceReflector } from "hediet-remoting";

export class ClientSocketIOStream extends BaseMessageStream {
	constructor(public readonly socket: SocketIOClient.Socket) {
		super();
		socket.on("message", (message: Message) => this.onMessage(message));
		socket.on("disconnect", () => this.resolveClosedPromise());
	}

	public write(message: Message): PromiseLike<void> {
		this.socket.send(message);
		return Promise.resolve();
	}

	public toString(): string {
		return `client-socket-io@${this.socket.io.uri}`;
	}
}

export function connect(uri: string): ClientSocketIOStream {
	return new ClientSocketIOStream(io(uri, { reconnection: false }));
}