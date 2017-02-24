import { Channel } from "./Channel";
import { RemotingServer, createProxy } from "./Remoting";
import { DecoratedServiceReflector, ServiceReflector, ServiceInfo } from "./ServiceInfo";
import { MessageStream, StreamChannel } from "./MessageStream";

// Convenience classes

export function createProxyByClass<T>(channel: Channel, clazz: { new(): T } | Function, remoteId: string|undefined = undefined): T {
	return createProxy(channel, new DecoratedServiceReflector(clazz));
}

export class SimpleStreamRemoting {
	public readonly channel: Channel;
	public readonly server: RemotingServer;

	/**
	 * Creates a new simple stream remoting instance.
	 * @param stream - The stream that is used for communication.
	 */
	constructor(stream: MessageStream) {
		this.server = new RemotingServer();
		this.channel = new StreamChannel(stream, this.server);
	}

	public createProxy<T>(info: ServiceInfo<T>, remoteId: string|undefined = undefined) {
		return createProxy(this.channel, info, remoteId);
	}

	public createProxyByClass<T>(clazz: { new(): T } | Function, remoteId: string|undefined = undefined) {
		return createProxyByClass(this.channel, clazz, remoteId);
	}
}
