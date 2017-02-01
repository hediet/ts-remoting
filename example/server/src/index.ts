import * as Common from "example-common";
import { SocketIOServer } from "hediet-remoting-socketio-server";
import { getProxy, RemotingServer, StreamChannel, DecoratedServiceReflector } from "hediet-remoting";

const clientConnections = new Set<ClientConnection>();

class ClientConnection {
	constructor(private readonly clientInterface: Common.ClientInterface) {}

	public updateText(text: string) {
		this.clientInterface.onUpdateText(text);
	}
}

class ServerInterfaceImpl implements Common.ServerInterface {
	constructor(public readonly clientConnection: ClientConnection) {}

	public async updateText(text: string): Promise<void> { 
		for (var connection of clientConnections) {
			connection.updateText(text);
		}
	}
}

new SocketIOServer(1234, async (stream, socket): Promise<void> => {
	const remotingServer = new RemotingServer();
	const channel = new StreamChannel(stream, remotingServer);
	const client = getProxy<Common.ClientInterface>("main", channel, new DecoratedServiceReflector(Common.ClientInterface));
	const clientConnection = new ClientConnection(client);
	remotingServer.registerObject("main", new DecoratedServiceReflector(Common.ServerInterface), new ServerInterfaceImpl(clientConnection));

	clientConnections.add(clientConnection);

	console.log("client connected");
	socket.on("disconnect", () => {
		console.log("client disconnected");
		clientConnections.delete(clientConnection);
	})
});
