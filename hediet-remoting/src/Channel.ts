import { Message, Request, RequestId, RequestMessage, RequestResult, ResponseMessage, isRequestOrNotification } from './DataTypes';
import { Disposable, dispose } from "hediet-framework/api/Disposable";
import { CancellationToken } from "hediet-framework/api/Cancellation";

export interface Channel {
	sendRequest(request: Request, messageIdCallback?: (requestId: RequestId) => Disposable|Disposable[]|undefined): PromiseLike<RequestResult<any, any>>;
	sendNotification(notification: Request): PromiseLike<void>;
}

export interface ChannelListener {
	handleRequest(request: Request, requestId: RequestId, token: CancellationToken): PromiseLike<RequestResult<any, any>>;
	handleNotification(request: Request, token: CancellationToken): PromiseLike<void>;
}

export class ChannelListenerAdapter implements Channel {
	private id: number;

	constructor(private readonly channelListener: ChannelListener) {
	}

	public sendRequest(request: Request, messageIdCallback?: (requestId: RequestId) => Disposable|Disposable[]|undefined): PromiseLike<RequestResult<any, any>> {

		const curId = this.id++;
		let disposables: Disposable|Disposable[]|undefined = undefined;
		if (messageIdCallback)
			disposables = messageIdCallback(curId);

		return this.channelListener.handleRequest(request, curId, CancellationToken.empty).then(result => {
			dispose(disposables);
			return result;
		}, error => {
			dispose(disposables);
			return Promise.reject(error);
		});
	}

	public sendNotification(notification: Request): PromiseLike<void> {
		return this.channelListener.handleNotification(notification, CancellationToken.empty);
	}
}

export interface MessageStream {
	setReadCallback(callback: ((readMessage: Message) => void)|undefined): void;
	write(message: Message): PromiseLike<void>;
}

export class StreamLogger implements MessageStream {
	constructor(private readonly baseStream: MessageStream) {}

	public setReadCallback(callback: ((readMessage: Message) => void)|undefined) {
		if (callback === undefined) {
			this.baseStream.setReadCallback(undefined);
			return;
		}

		this.baseStream.setReadCallback((readMessage) => {
			console.log("< " + JSON.stringify(readMessage));
			callback(readMessage);
		});
	}

	public write(message: Message): PromiseLike<void> {
		console.log("> " + JSON.stringify(message));
		return this.baseStream.write(message);
	}
}

export class StreamChannel implements Channel {
	
	private readonly unprocessedResponses: { [id: string]: (response: ResponseMessage) => void } = {};
	private requestId = 0;

	constructor(private readonly stream: MessageStream, private readonly listener: ChannelListener|undefined) {
		this.stream.setReadCallback((message) => this.processMessage(message));
	}

	private async processMessage(message: Message): Promise<void> {
		if (isRequestOrNotification(message)) {
			if (!this.listener) {
				// ignore message
				return;
			}

			if (message.id === undefined) {
				this.listener.handleNotification(message, CancellationToken.empty);
			}
			else {
				const result = await this.listener.handleRequest(message, message.id, CancellationToken.empty);
				const responseMsg: ResponseMessage = { id: message.id, result: result.result, error: result.error };
				this.stream.write(responseMsg);
			}
		}
		else { // response
			const callback = this.unprocessedResponses["" + message.id];
			delete this.unprocessedResponses["" + message.id];
			callback(message);
		}
	}

	private newRequestId(): RequestId {
		return this.requestId++;
	}

	public sendRequest(request: Request, messageIdCallback?: (requestId: RequestId) => Disposable|Disposable[]|undefined): PromiseLike<RequestResult<any, any>> {
		const msg = { id: this.newRequestId(), method: request.method, params: request.params };

		let disposables: Disposable|Disposable[]|undefined = undefined;
		if (messageIdCallback)
			disposables = messageIdCallback(msg.id!);

		return new Promise<RequestResult<any, any>>((resolve, reject) => {

			this.unprocessedResponses["" + msg.id] = (response) => {
				dispose(disposables);
				resolve(response);
			};

			this.stream.write(msg).then(undefined, reason => 
				{
					delete this.unprocessedResponses["" + msg.id];
					dispose(disposables);
					reject(reason);
				});
		});
	}

	public sendNotification(notification: Request): PromiseLike<void> {
		const msg: Message = { id: undefined, method: notification.method, params: notification.params };
		
		return this.stream.write(msg);
	}
}