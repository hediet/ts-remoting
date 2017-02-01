import { Promise as Task, CancellationToken } from "hediet-framework/dist/Promises";
import * as _ from "hediet-framework/dist/Underscore";
import { Channel, ChannelListener } from "./Channel";
import { Request, RequestId, RequestResult } from "./DataTypes";

export interface IRegistryOf<T> {
	register(model: T): void;
}

export class WebsocketServer<TClientModel> {

	registerServerModel(serverModel: IRegistryOf<TClientModel>, serverModelId: string) {
		
	}
}


export interface Address {
	port: number;
	host: string;
	extensionId: string;
}

export class WebsocketClient<TServerModel> {

	constructor(server: Address, clientModel: IRegistryOf<TServerModel>, serverModelId: string) {

	}
}






export interface ServiceMethodInfo {
	readonly isOneWay: boolean;
	readonly name: string;
}

export interface ServiceInfo {
	readonly methods: ReadonlyArray<ServiceMethodInfo>;
}

export interface ServiceMethodReflector extends ServiceMethodInfo {
	call(target: any, args: any[]): PromiseLike<any>|null;
}

export interface ServiceReflector extends ServiceInfo {
	readonly methods: ReadonlyArray<ServiceMethodReflector>;
	getMethod(methodName: string): ServiceMethodReflector|undefined;
}

function serializeServiceInfo(reflector: ServiceInfo): ServiceInfo {
	const serviceInfo: ServiceInfo = { methods: reflector.methods.map(m => ({ name: m.name, isOneWay: m.isOneWay }) as ServiceMethodInfo) };
	return serviceInfo;
}

export class DecoratedServiceReflector implements ServiceReflector {

	readonly methods: ServiceMethodReflector[];

	constructor(private readonly _class: Function) {
		const remotableFunctions = ((_class.prototype as any)["remotableFunctions"] as ServiceMethodInfo[]) || [];
		this.methods = remotableFunctions.map(f => new DecoratedMethodInfo(f));
	}

	getMethod(methodName: string): ServiceMethodReflector|undefined {
		return _.find(this.methods, m => m.name === methodName);
	}
}

class DecoratedMethodInfo implements ServiceMethodReflector {
	public readonly isOneWay: boolean;
	public readonly name: string;

	constructor(methodInfo: ServiceMethodInfo) {
		this.isOneWay = methodInfo.isOneWay;
		this.name = methodInfo.name;
	}

	public call(target: any, args: any[]): PromiseLike<any>|null {
		const func = target[this.name] as Function;
		return func.call(target, ...args);
	}
}

export function remotable({ isOneWay = false } = {}) {
	return function(target: any, methodName: string) {
		let remotableFunctions = target["remotableFunctions"] as ServiceMethodInfo[];
		if (!remotableFunctions)
			target["remotableFunctions"] = (remotableFunctions = []);

		remotableFunctions.push({ name: methodName, isOneWay: isOneWay });
	}
}

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

export async function getRemoteServiceInfo(remoteId: string, channel: Channel): Task<ServiceInfo> {
	const objectInfoMsg = await channel.sendRequest({ method: getObjectInfoMethod, params: [remoteId] });
	const info = objectInfoMsg.result as ServiceInfo;
	return info;
}

export function getProxy<T>(remoteId: string, channel: Channel, info: ServiceInfo): T {
	const result: { [name: string]: any } = {};

	for (const i of info.methods) {
		result[i.name] = async function(...args: any[]): Task<undefined | any> {
			const msg = { method: ServiceMethod.compose(remoteId, i.name), params: args };
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
	private services: { [id: string]: [ServiceReflector, any] } = {};

	constructor() {
		const services = this.services;

		class RemotingManagerService {
			@remotable()
			public async [getObjectInfoMethodName](id: string): Task<ServiceInfo> {
				const reflector = services[id][0];
				return serializeServiceInfo(reflector);
			}
		}

		this.registerObject(remotingServerId, new DecoratedServiceReflector(RemotingManagerService), new RemotingManagerService());
	}


	public registerObject(id: string, reflector: ServiceReflector, target: any) {
		this.services[id] = [ reflector, target ];
	}

	private getServiceMethod(request: Request) {
		const { serviceId, serviceMethod } = ServiceMethod.parse(request.method)!;
		const [ reflector, targetObj ] = this.services[serviceId];
		const method = reflector.getMethod(serviceMethod);
		return [ method, targetObj ];
	}

	public async handleRequest(request: Request, requestId: RequestId, token: CancellationToken): Task<RequestResult<any, any>> {
		const [ method, targetObj ] = this.getServiceMethod(request)!;
		if (method.isOneWay) throw "Method must not be one way";

		const result = await method.call(targetObj, request.params);
		return { result, error: undefined };
	}

	public async handleNotification(request: Request, token: CancellationToken): Task<void> {
		const [ serviceMethod, targetObj ] = this.getServiceMethod(request)!;
		if (!serviceMethod.isOneWay) throw "Method must be one way";

		serviceMethod.call(targetObj, request.params);
	}
}
