import { CancellationToken } from "hediet-framework/api/Cancellation";
import { Maybe, result, error, isError, isResult } from "hediet-framework/api/Containers";
import { Channel, ChannelListener, Request, Response } from "./Channel";
import { RequestId, ErrorCode, ErrorInfo } from "./DataTypes";
import { DecoratedServiceReflector, requestHandler, serializeServiceInfo, ServiceInfo, ServiceReflector, ServiceMethodReflector } from "./ServiceInfo";

export interface ServiceMethod {
	serviceId: string;
	serviceMethod: string;
}

export namespace ServiceMethod {
	export function compose(serviceId: string, serviceMethod: string): string {
		return toString({ serviceId, serviceMethod });
	}

	export function toString(serviceMethod: ServiceMethod): string {
		return `${serviceMethod.serviceId}/${serviceMethod.serviceMethod}`;
	}

	export function parse(method: string): ServiceMethod|undefined {
		const [ serviceId, serviceMethod ] = method.split("/", 2);
		if (method === undefined) return undefined;
		return { serviceId, serviceMethod };
	}
}

const remotingServerId = "$remotingServer";
const getObjectInfoMethodName = "getObjectInfo";
const getObjectInfoMethod = ServiceMethod.compose(remotingServerId, getObjectInfoMethodName);

export async function getRemoteServiceInfo<T>(channel: Channel, remoteId: string): Promise<ServiceInfo<T>> {
	const objectInfoMsg = await channel.sendRequest({ method: getObjectInfoMethod, params: [remoteId] });
	const info = objectInfoMsg.result as ServiceInfo<T>;
	return info;
}

class Proxy {
	constructor(private readonly _channel: Channel, private readonly _remoteId: string) { }

	public toString() {
		return `${this._remoteId}@${this._channel.toString()}`;
	}
}

export function createProxy<T>(channel: Channel, info: ServiceInfo<T>, remoteId?: string): T {
	const actualRemoteId = remoteId || info.defaultRemoteId;
	if (!actualRemoteId) throw "remoteId and info.defaultRemoteId not set!";

	const result: { [name: string]: any } = new Proxy(channel, actualRemoteId);

	for (const i of info.methods) {
		const methodName = ServiceMethod.compose(actualRemoteId, i.name);
		result[i.name] = async function(...args: any[]): Promise<undefined | any> {
			const msg = { method: methodName, params: args };
			if (i.isOneWay) {
				await channel.sendNotification(msg);
				return undefined;
			}
			else {
				const response = await channel.sendRequest(msg);
				return response.result;
			}
		};
	}
	return result as T;
}

export class RemotingServer implements ChannelListener {
	private services: { [id: string]: [ServiceReflector<any>, any] } = {};

	constructor() {
		const services = this.services;

		class RemotingManagerService {
			@requestHandler()
			public async [getObjectInfoMethodName](id: string): Promise<ServiceInfo<any>> {
				const reflector = services[id][0];
				return serializeServiceInfo(reflector);
			}
		}

		this.registerObject(new DecoratedServiceReflector(RemotingManagerService), new RemotingManagerService(), remotingServerId);
	}

	public registerObject<T, X extends T>(reflector: ServiceReflector<T>, target: X, remoteId?: string) {
		const actualRemoteId = remoteId || reflector.defaultRemoteId;
		if (!actualRemoteId) throw new Error("remoteId and info.defaultRemoteId not set.");

		this.services[actualRemoteId] = [ reflector, target ];
	}

	public registerObjectByClass<T, X extends T>(clazz: { new(): T } | Function, target: X, remoteId?: string) {
		this.registerObject(new DecoratedServiceReflector(clazz), target, remoteId);
	}

	private getServiceMethod(request: Request): Maybe<{ method: ServiceMethodReflector, targetObj: any }, ErrorInfo<any>> {
		const parseResult = ServiceMethod.parse(request.method);
		if (!parseResult)
			return error({ code: ErrorCode.methodNotFound, message: `Method '${request.method}' has invalid format.`, data: undefined });

		const { serviceId, serviceMethod } = parseResult;

		if (!(serviceId in this.services))
			return error({ code: ErrorCode.methodNotFound, message: `Service with id '${serviceId}' is not available.`, data: undefined });

		const [ reflector, targetObj ] = this.services[serviceId];

		const method = reflector.getMethod(serviceMethod);
		if (!method) 
			return error({ code: ErrorCode.methodNotFound, message: `Service with id '${serviceId}' cannot handle method ${serviceMethod}.`, data: undefined });

		return result({ method, targetObj });
	}

	public async handleRequest(request: Request, requestId: RequestId, token: CancellationToken): Promise<Response<any, any>> {
		const result = this.getServiceMethod(request);

		if (isError(result)) return { result: undefined, error: result.value };

		const { method, targetObj } = result.value;
		if (method.isOneWay) 
			return { result: undefined, error: { code: ErrorCode.invalidRequest, message: "Method can only handle notifications.", data: undefined } };

		const response = await method.call(targetObj, request.params);
		
		return response!; // todo assert response !== null
	}

	public async handleNotification(request: Request, token: CancellationToken): Promise<void> {
		const result = this.getServiceMethod(request);

		if (isError(result)) {
			return; // todo
		}

		const { method, targetObj } = result.value;
		if (!method.isOneWay) {
			return; // todo
		}

		const response = method.call(targetObj, request.params);
		// todo assert response === null
	}
}
