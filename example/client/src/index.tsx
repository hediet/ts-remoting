import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classNames from "classnames";
import { observable, computed, autorun } from "mobx";
import { observer } from "mobx-react";
import DevTools from 'mobx-react-devtools'; 
import "./style.scss";
import * as Common from "example-common";
import { SocketIOClient } from "hediet-remoting-socketio-client";
import { getProxy, StreamChannel, StreamLogger, DecoratedServiceReflector, RemotingServer } from "hediet-remoting";


class Model {
	@observable localText: string;
	@observable text: string;
	@observable serverInterface: Common.ServerInterface|null = null;

	constructor() {
		autorun(() => this.updateServer());
	}

	private updateServer() {
		this.text = this.localText;
		if (server) {
			console.log(server);
			server.updateText(this.localText);
		}
	}
}

class ClientInterfaceImpl implements Common.ClientInterface {
	constructor(private readonly model: Model) { }

	public async onUpdateText(text: string): Promise<void> {
		this.model.text = text;
	}
}

const model = new Model();

const socketIOClient = new SocketIOClient("http://localhost:1234");
const remotingServer = new RemotingServer();
remotingServer.registerObject("main", new DecoratedServiceReflector(Common.ClientInterface), new ClientInterfaceImpl(model));
const channel = new StreamChannel(new StreamLogger(socketIOClient.stream), remotingServer);
const server = getProxy<Common.ServerInterface>("main", channel, new DecoratedServiceReflector(Common.ServerInterface));


@observer
class GUI extends React.Component<{}, {}> {
	render() {
		return (
			<div>
				<DevTools />
				<input value={model.text} onChange={event => model.localText = event.target.value} />
			</div>
		);
	}
}

var target = document.createElement("div");
ReactDOM.render(<GUI />, target);
document.body.appendChild(target);

