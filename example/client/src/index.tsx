import * as React from "react";
import * as ReactDOM from "react-dom";
import { connect } from "hediet-remoting-socketio-client";
import { SimpleStreamRemoting, StreamLogger } from "hediet-remoting";

import * as Common from "example-common";

import { Model, ClientInterfaceImpl } from "./models";
import { GUI } from "./components";


const model = new Model();

const remoting = new SimpleStreamRemoting(new StreamLogger(connect("http://localhost:1234")));
remoting.server.registerObjectByClass(Common.ClientInterface, new ClientInterfaceImpl(model));
model.serverInterface = remoting.createProxyByClass(Common.ServerInterface);

const username = prompt("Username", "user");
model.serverInterface.login(username!);

var target = document.createElement("div");
ReactDOM.render(<GUI model={model} />, target);
document.body.appendChild(target);

