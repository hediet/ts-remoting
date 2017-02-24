import { IDisposable, dispose } from "hediet-framework/api/Disposable";
import { CancellationToken } from "hediet-framework/api/Cancellation";
import { Message, RequestId, RequestMessage, ErrorInfo } from './DataTypes';

export interface Request {
	method: string;
	params: any;
}

export interface Response<TResult, TErrorData> {
	result: TResult|undefined;
	error: ErrorInfo<TErrorData>|undefined;
}

/**
 * A channel has methods to send requests and notifications.
 * A request gets a response back, a notification does not.
 */
export interface Channel {
	/**
	 * Sends a request.
	 * @param request - The request to send.
	 * @param messageIdCallback - An optional callback that is called before the request is sent.
	 * 			The passed request id can be used to track the request.
	 * @return A promise of an untyped response. Fails if the request could not be delivered or if an response could not be received.
	 */
	sendRequest(request: Request, messageIdCallback?: (requestId: RequestId) => void): PromiseLike<Response<any, any>>;

	/**
	 * Sends a notification. 
	 * @return A promise that is fulfilled as soon as the notification has been sent successfully. 
	 * 			Fails if the notification could not be delivered.
	 */
	sendNotification(notification: Request): PromiseLike<void>;

	/**
	 * Returns human readable information of this channel.
	 */
	toString(): string;
}


export function sendRequestWithDisposer(channel: Channel, request: Request, messageIdCallback: (requestId: RequestId) => IDisposable|IDisposable[]|undefined) {
	let disposables: IDisposable|IDisposable[]|undefined = undefined;

	return channel.sendRequest(request, (requestId) => {
			disposables = messageIdCallback(requestId);
		}).then((result) => {
			dispose(disposables);
			return Promise.reject(result);
		}, (reason) => {
			dispose(disposables);
			return Promise.reject(reason);
		});
}


/**
 * A channel listener is an object that can handle requests and notifications.
 * Implementations must respond to all requests.
 */
export interface ChannelListener {
	/**
	 * Handles an incoming request.
	 */
	handleRequest(request: Request, requestId: RequestId, token: CancellationToken): PromiseLike<Response<any, any>>;
	handleNotification(request: Request, token: CancellationToken): PromiseLike<void>;
}

/**
 * Implements a channel by using a channel listener.
 */
export class ChannelListenerAdapter implements Channel {
	private id: number;

	constructor(private readonly channelListener: ChannelListener) {}

	public sendRequest(request: Request, messageIdCallback?: (requestId: RequestId) => IDisposable|IDisposable[]|undefined): PromiseLike<Response<any, any>> {
		const curId = this.id++;
		let disposables: IDisposable|IDisposable[]|undefined = undefined;
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
