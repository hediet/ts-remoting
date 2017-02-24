import * as _ from "hediet-framework/api/Underscore";
import { Response } from "./Channel";
import { ErrorCode } from "./DataTypes";

export interface ServiceMethodInfo {
	readonly isOneWay: boolean;
	readonly name: string;
}

export interface ServiceInfo<T> {
	readonly _service_info_brand?: T; // to store T
	readonly defaultRemoteId: string|undefined;
	readonly methods: ReadonlyArray<ServiceMethodInfo>;
}

export interface ServiceMethodReflector extends ServiceMethodInfo {
	call(target: any, args: any[]): PromiseLike<Response<any, any>>|null;
}

export interface ServiceReflector<T> extends ServiceInfo<T> {
	readonly methods: ReadonlyArray<ServiceMethodReflector>;
	getMethod(methodName: string): ServiceMethodReflector|undefined;
}

export function serializeServiceInfo<T>(reflector: ServiceInfo<T>): ServiceInfo<T> {
	const serviceInfo: ServiceInfo<T> = { 
		methods: reflector.methods.map(m => ({ name: m.name, isOneWay: m.isOneWay }) as ServiceMethodInfo),
		defaultRemoteId: reflector.defaultRemoteId
	};
	return serviceInfo;
}


/**
 * Creates a reflector for a class.
 * Uses remotable decorations to determine which methods can be invoked remotely.
 */
export class DecoratedServiceReflector<T> implements ServiceReflector<T> {
	readonly _service_info_brand: T;
	readonly methods: ServiceMethodReflector[];
	get defaultRemoteId() { return this.clazz.name; }

	constructor(private readonly clazz: { new(): T } | Function) {
		const remotableFunctions = ((clazz.prototype as any)["remotableFunctions"] as ServiceMethodInfo[]) || [];
		this.methods = remotableFunctions.map(f => new DecoratedMethodInfo(f));
	}

	getMethod(methodName: string): ServiceMethodReflector|undefined {
		return _.find(this.methods, m => m.name === methodName);
	}
}

export class ServiceError extends Error {
	constructor(message: string, public readonly errorCode: ErrorCode = ErrorCode.internalError) {
		super(message);

		Object.setPrototypeOf(this, ServiceError.prototype);
	}
}

class DecoratedMethodInfo implements ServiceMethodReflector {
	public readonly isOneWay: boolean;
	public readonly name: string;

	constructor(methodInfo: ServiceMethodInfo) {
		this.isOneWay = methodInfo.isOneWay;
		this.name = methodInfo.name;
	}

	public async call(target: any, args: any[]): Promise<Response<any, any>> {
		const func = target[this.name] as Function;
		try {
			const result = await func.call(target, ...args);
			return { result, error: undefined };
		}
		catch (e) {
			if (e instanceof ServiceError) {
				return { result: undefined, error: { code: e.errorCode, message: e.message, data: undefined } };
			}
			throw e;
		}
	}
}

export interface RemotableArgs {
	/**
	 * Determines whether this method is a notification or request handler.
	 * Notification handlers are one-way: They must not send responses.
	 * However, request handler must send responses back.
	 */
	isOneWay?: boolean;
}

/**
 * Decorates a method to be remotable.
 */
export function requestHandler(args: RemotableArgs = {}) {
	return function(target: any, methodName: string) {
		let remotableFunctions = target["remotableFunctions"] as ServiceMethodInfo[];
		if (!remotableFunctions)
			target["remotableFunctions"] = (remotableFunctions = []);

		remotableFunctions.push({ name: methodName, isOneWay: args.isOneWay!! });
	}
}

export function notificationHandler(args: RemotableArgs & { isOneWay?: true } = {}) {
	return requestHandler({ isOneWay: true });
}
