import { CancellationToken, Promise } from "hediet-framework/dist/promises";
import { Disposable } from "hediet-framework/dist/disposable";
import { Request, RequestResult, RequestId, Message } from "./DataTypes";

export interface RequestType<TIn, TOut, TError> {
	type: "RequestType";
	id: string;
}

export interface NotificationType<TIn> {
	type: "NotificationType";
	id: string;
}


export function requestType<TIn, TOut, TError>(id: string): RequestType<TIn, TOut, TError> {
	return { id: id, type: "RequestType" };
}

export function notificationType<TIn>(id: string): NotificationType<TIn> {
	return { id: id, type: "NotificationType" };
}



class RequestRegistrar<TIn, TOut, TError> {
	public registerHandler(handler: (params: TIn, cancellationToken: CancellationToken, requestId: RequestId) => PromiseLike<TOut>) {

	}

	public registerSyncHandler(handler: (params: TIn, cancellationToken: CancellationToken) => TOut) {

	}
}

class NotificationRegistrar<TIn> {
	public registerHandler(handler: (params: TIn, cancellationToken: CancellationToken) => PromiseLike<void>) {

	}

	public registerSyncHandler(handler: (params: TIn, cancellationToken: CancellationToken) => void, predicate?: (params: TIn) => boolean): Disposable {

	}
}


class RequestSender<TIn, TOut, TError> {
	constructor(private readonly requestType: RequestType<TIn, TOut, TError>) {}

	public sendThrow(arg: TIn, requestIdCallback?: (requestId: RequestId) => Disposable[]|void): PromiseLike<TOut> {

	}

	public send(arg: TIn, requestIdCallback?: (requestId: RequestId) => Disposable[]|void): PromiseLike<RequestResult<TOut, TError>> {

	}
}

class NotificationSender<TIn> {
	constructor(private readonly notificationType: NotificationType<TIn>) {}

	public send(arg: TIn): PromiseLike<void> {

	}
}


class Connection {
	constructor(private channel: ListenableChannel) {

	}

	public listen(token: CancellationToken = CancellationToken.empty): PromiseLike<void> {

	}

	public tryCancelOngoingIncomingRequest(id: RequestId): boolean {

	}

	public getRequestRegistrar<TIn, TOut, TError>(requestType: RequestType<TIn, TOut, TError>): RequestRegistrar<TIn, TOut, TError> {

	}
	public getNotificationRegistrar<TIn>(requestType: NotificationType<TIn>): NotificationRegistrar<TIn> {

	}



	public getRequestSender<TIn, TOut, TError>(requestType: RequestType<TIn, TOut, TError>): RequestSender<TIn, TOut, TError> {

	}

	public getNotificationSender<TIn>(requestType: NotificationType<TIn>): NotificationSender<TIn> {

	}
}








/*
const loginRequest = requestType<{ usr: string, pwd: string }, { loginSuccessful: boolean }, void>("login");



const streamDataRequest = requestType<{ dataName: string }, void, void>("streamData");
const streamingStartNotification = notificationType<{ streamRequestId: RequestId, totalSize: number }>("streamStart");
const streamingStepNotification = notificationType<{ streamRequestId: RequestId, offset: number, payload: string }>("streamStep");


async function test() {

	const c1: Connection = new Connection(new WebsocketServerChannel("localhost", 12345));

	c1.getRequestRegistrar(streamDataRequest).registerHandler(async function (request, token, requestId): Task<void> {
		
		if (request.dataName != "data.bin") throw "error";
		
		for (let i = 0; i < 10; i++) {
			if (token.isCancelled) throw "cancelled";
			await c1.getNotificationSender(streamingStepNotification).send({ streamRequestId: requestId, offset: i, payload: "1" });
		}
		
	});
	c1.listen();


	const c2: Connection = new Connection(new WebsocketClientChannel("localhost", 12345));

	await c2.getRequestSender(streamDataRequest).send({ dataName: "data.bin" }, (requestId) => {
		var disposables = [];

		disposables.push(c2.getNotificationRegistrar(streamingStartNotification).registerSyncHandler((data) => {
			
			showProgressbar(data.totalSize);

		}, data => data.streamRequestId === requestId));

		disposables.push(c2.getNotificationRegistrar(streamingStepNotification).registerSyncHandler((data) => {
			
			updateProgressbar(data.offset);

		}, data => data.streamRequestId === requestId));

		return disposables;
	});



}




var result = send(loginRequest)({ usr: "" }).loginSuccessful;
*/
