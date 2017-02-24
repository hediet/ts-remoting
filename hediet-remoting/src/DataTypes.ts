
// must be an integer
export interface ErrorCode extends Number { }

export module ErrorCode {
	/**
	 * Invalid JSON was received by the server.
	 * An error occurred on the server while parsing the JSON text.
	 */
	export const parseError = -32700 as ErrorCode;

	/**
	 * The JSON sent is not a valid Request object.
	 */
	export const invalidRequest = -32600 as ErrorCode;

	/**
	 * The method does not exist/is not available.
	 */
	export const methodNotFound = -32601 as ErrorCode;

	/**
	 * Invalid method parameter(s).
	 */
	export const invalidParams = -32602 as ErrorCode;

	/**
	 * 	Internal JSON-RPC error.
	 */
	export const internalError = -32603 as ErrorCode;

	export function serverError(code: number): ErrorCode {
		if (!((-32099 <= code) && (code <= -32000))) throw new Error("Invalid range.");

		return code as ErrorCode;
	}

	export function applicationError(code: number): ErrorCode {
		// todo implement proper checks.
		return code as ErrorCode;
	}
}

export interface Error {
	code: ErrorCode;
	message: string;
	data: any;
}

export enum IdKind {
	string, long, double, null
}

export function isRequestOrNotification(msg: Message): msg is RequestMessage {
	return (msg as any).method !== undefined;
}

export type Message = RequestMessage | ResponseMessage;

export type RequestId = number | string | null;

export interface RequestMessage {
	method: string;
	params: any;
	id: RequestId|undefined; // should not be null or a fractional number. Is undefined if Request is a Notification.
}

export interface ResponseMessage {
	id: RequestId; // If there was an error in detecting the id in the Request object (e.g. Parse error/Invalid Request), it MUST be Null.
	result: any|undefined;
	error: ErrorInfo<any>|undefined; // error == undefined <=> result != undefined
}

export interface ErrorInfo<TData> {
	code: ErrorCode;
	message: string;
	data: TData;
}

