# hediet-remoting

A well designed remoting library that can be used in browsers and by nodejs.

## Installation

`hediet-remoting` can be installed via the node package manager using the command `npm install hediet-remoting`.

## Usage

First, interfaces should be defined that are shared between client and server:
```typescript
export abstract class ClientInterface {
	@notificationHandler()
	public onReceiveMessage(message: string, from: string) {}
}

export abstract class ServerInterface {
	@requestHandler()
	public login(username: string): Promise<void> { throw "not implemented"; }

	@requestHandler()
	public broadcastMessage(message: string): Promise<void> { throw "not implemented"; }
}
```

Server code:
```typescript
import { SocketIOServer } from "hediet-remoting-socketio-server";
import { SimpleStreamRemoting, ServiceException } from "hediet-remoting";

const connections = new Set<ServerInterfaceImpl>();

// server side implementation of the server interface.
class ServerInterfaceImpl implements ServerInterface {
	private username: string = undefined;
	constructor(private readonly clientInterface: ClientInterface) {}

	public async login(username: string): Promise<void> {
		this.connection.username = username;
	}

	public async broadcastMessage(message: string): Promise<void> {
		// Service exceptions are marshalled to the client
		if (!this.connection.username) throw new ServiceException("Please login first.");

		// call onReceiveMessage for each connected client
		for (const con of connections) { con.clientInterface.onReceiveMessage(message, this.username); }
	}
}

new SocketIOServer(1234, async (stream): Promise<void> => {
	const remoting = new SimpleStreamRemoting(stream);
	// create a proxy that implements ClientInterface and 
	const client = remoting.createProxyByClass(ClientInterface);
	const serverImpl = new ServerInterfaceImpl(client);
	remoting.server.registerObjectByClass(ServerInterface, serverImpl);
	
	clientConnections.add(serverImpl);
	await stream.closedPromise;
	clientConnections.delete(serverImpl);
});
```

Client code:

```typescript
import { connect } from "hediet-remoting-socketio-client";
import { SimpleStreamRemoting, StreamLogger } from "hediet-remoting";

class ClientInterfaceImpl implements ClientInterface {
	public onReceiveMessage(message: string, from: string) {
		console.log(message + " from " + from);
	}
}

// stream logger logs every sent message to the console.
const remoting = new SimpleStreamRemoting(new StreamLogger(connect("http://localhost:1234")));
remoting.server.registerObjectByClass(ClientInterface, new ClientInterfaceImpl(model));
const serverInterface = remoting.createProxyByClass(ServerInterface);

async function main() {
	await serverInterface.login("myUsername");
	await serverInterface.broadcastMessage("foo");
}

main();
```