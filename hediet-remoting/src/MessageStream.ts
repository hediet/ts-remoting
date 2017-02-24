import { CancellationToken } from "hediet-framework/api/Cancellation";
import { ErrorCode, Message, RequestId, RequestMessage, ResponseMessage, isRequestOrNotification } from './DataTypes';
import { Request, Response, Channel, ChannelListener } from './Channel';

export interface MessageStream {
	/**
	 * Sets a callback for incoming messages.
	 * The callback is not called immediately within setReadCallback.
	 */
	setReadCallback(callback: ((readMessage: Message) => void)|undefined): void;

	closedPromise: Promise<void>;

	/**
	 * Writes a message to the stream.
	 */
	write(message: Message): PromiseLike<void>;

	/**
	 * Returns human readable information of this message stream.
	 */
	toString(): string;
}

export abstract class BaseMessageStream implements MessageStream {
	private unreadMessages: Message[] = [];
	protected onMessageCallback: ((readMessage: Message) => void)|undefined;

	protected resolveClosedPromise: () => void;
	public closedPromise: Promise<void> = new Promise<void>(resolve => this.resolveClosedPromise = resolve);

	protected onMessage(message: Message) {
		const hasReadAllQueuedMessages = this.unreadMessages.length === 0;
		if (hasReadAllQueuedMessages && this.onMessageCallback)
			this.onMessageCallback(message);
		else
			this.unreadMessages.push(message);
	}

	public setReadCallback(callback: ((readMessage: Message) => void)|undefined) {
		this.onMessageCallback = callback;
		
		if (!callback) return;

		setTimeout(() => {
			while (this.unreadMessages.length > 0) {
				const msg = this.unreadMessages.shift()!;
				callback(msg);
			}
		}, 0);
	}

	public abstract write(message: Message): PromiseLike<void>;

	public abstract toString(): string;
}

export class StreamLogger implements MessageStream {
	constructor(private readonly baseStream: MessageStream) {}

	public get closedPromise() { return this.baseStream.closedPromise; }

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

	public toString(): string {
		return `StreamLogger/${this.baseStream.toString()}`;
	}
}

export class StreamChannel implements Channel {
	private readonly unprocessedResponses: { [id: string]: (response: ResponseMessage) => void } = {};
	private requestId = 0;

	constructor(private readonly stream: MessageStream, private readonly listener: ChannelListener|undefined) {
		this.stream.setReadCallback((message) => this.processMessage(message));
	}

	private processMessage(message: Message) {
		if (isRequestOrNotification(message))
			this.processRequestOrNotification(message);
		else
			this.processResponse(message);
	}

	private async processRequestOrNotification(message: RequestMessage) {
		if (message.id === undefined) {
			if (!this.listener) {
				// ignore message // TODO: log?
				return;
			}

			this.listener.handleNotification(message, CancellationToken.empty);
		}
		else {
			let result: Response<any, any>;
			if (this.listener) {
				try {
					result = await this.listener.handleRequest(message, message.id, CancellationToken.empty);
				}
				catch (ex) {
					// do not leak exception details to client as it could contain sensitive information.
					// TODO: log
					result = { result: undefined, error: { code: ErrorCode.internalError, message: "An unexpected exception was thrown.", data: undefined } };
				}
			}
			else {
				result = { result: undefined, error: { code: ErrorCode.methodNotFound, message: "This server does not listen for requests or notifications.", data: undefined } };
			}
			const responseMsg: ResponseMessage = { id: message.id, result: result.result, error: result.error };
			await this.stream.write(responseMsg);
		}
	}

	private processResponse(message: ResponseMessage) {
		const callback = this.unprocessedResponses["" + message.id];
		delete this.unprocessedResponses["" + message.id];
		callback(message);
	}

	private newRequestId(): RequestId {
		return this.requestId++;
	}

	public sendRequest(request: Request, messageIdCallback?: (requestId: RequestId) => void): PromiseLike<Response<any, any>> {
		const msg = { id: this.newRequestId(), method: request.method, params: request.params };

		if (messageIdCallback)
			messageIdCallback(msg.id!);

		return new Promise<Response<any, any>>((resolve, reject) => {

			this.unprocessedResponses["" + msg.id] = (response) => {
				resolve(response);
			};

			this.stream.write(msg).then(undefined, (reason) => 
				{
					delete this.unprocessedResponses["" + msg.id];
					reject(reason);
				});
		});
	}

	public sendNotification(notification: Request): PromiseLike<void> {
		const msg: Message = { id: undefined, method: notification.method, params: notification.params };
		
		return this.stream.write(msg);
	}

	public toString(): string {
		return "StreamChannel/" + this.stream.toString();
	}
}