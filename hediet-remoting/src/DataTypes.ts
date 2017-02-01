
// must be an integer
export interface ErrorCode extends Number { }

export module ErrorCode {
	export const parseError = -32700 as ErrorCode;
	export const invalidRequest = -32600 as ErrorCode;
	export const methodNotFound = -32601 as ErrorCode;
	export const invalidParams = -32602 as ErrorCode;
	export const internalError = -32603 as ErrorCode;
	export const serverErrorStart = -32099 as ErrorCode;
	export const serverErrorEnd = -32000 as ErrorCode;
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

export interface Request {
	method: string;
	params: any;
}

export interface RequestResult<TResult, TErrorData> {
	result: TResult|undefined;
	error: ErrorInfo<TErrorData>|undefined;
}
