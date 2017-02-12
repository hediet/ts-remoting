import { CancellationToken } from "hediet-framework/api/Cancellation";
import * as _ from "hediet-framework/api/Underscore";
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

export interface ServiceInfo<T> {
	readonly _service_info_brand?: T; // to store T
	readonly defaultRemoteId: string|undefined;
	readonly methods: ReadonlyArray<ServiceMethodInfo>;
}

export interface ServiceMethodReflector extends ServiceMethodInfo {
	call(target: any, args: any[]): PromiseLike<any>|null;
}

export interface ServiceReflector<T> extends ServiceInfo<T> {
	readonly methods: ReadonlyArray<ServiceMethodReflector>;
	getMethod(methodName: string): ServiceMethodReflector|undefined;
}

function serializeServiceInfo<T>(reflector: ServiceInfo<T>): ServiceInfo<T> {
	const serviceInfo: ServiceInfo<T> = { 
		methods: reflector.methods.map(m => ({ name: m.name, isOneWay: m.isOneWay }) as ServiceMethodInfo),
		defaultRemoteId: reflector.defaultRemoteId
	};
	return serviceInfo;
}

export class DecoratedServiceReflector<T> implements ServiceReflector<T> {

	readonly _service_info_brand: T;
	readonly methods: ServiceMethodReflector[];
	get defaultRemoteId() { return this._class.name; }

	constructor(private readonly _class: { new(): T } | Function) {
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

export function remotable(args: { isOneWay?: boolean } = {}) {
	return function(target: any, methodName: string) {
		let remotableFunctions = target["remotableFunctions"] as ServiceMethodInfo[];
		if (!remotableFunctions)
			target["remotableFunctions"] = (remotableFunctions = []);

		remotableFunctions.push({ name: methodName, isOneWay: args.isOneWay!! });
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

export async function getRemoteServiceInfo<T>(channel: Channel, remoteId: string): Promise<ServiceInfo<T>> {
	const objectInfoMsg = await channel.sendRequest({ method: getObjectInfoMethod, params: [remoteId] });
	const info = objectInfoMsg.result as ServiceInfo<T>;
	return info;
}

export function getProxy<T>(channel: Channel, info: ServiceInfo<T>, remoteId?: string): T {
	const result: { [name: string]: any } = {};

	const actualRemoteId = remoteId || info.defaultRemoteId;
	if (!actualRemoteId) throw "remoteId and info.defaultRemoteId not set!";

	for (const i of info.methods) {
		result[i.name] = async function(...args: any[]): Promise<undefined | any> {
			const msg = { method: ServiceMethod.compose(actualRemoteId, i.name), params: args };
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
			@remotable()
			public async [getObjectInfoMethodName](id: string): Promise<ServiceInfo<any>> {
				const reflector = services[id][0];
				return serializeServiceInfo(reflector);
			}
		}

		this.registerObject(new DecoratedServiceReflector(RemotingManagerService), new RemotingManagerService(), remotingServerId);
	}


	public registerObject<T, X extends T>(reflector: ServiceReflector<T>, target: X, remoteId?: string) {
		const actualRemoteId = remoteId || reflector.defaultRemoteId;
		if (!actualRemoteId) throw "remoteId and info.defaultRemoteId not set!";

		this.services[actualRemoteId] = [ reflector, target ];
	}

	private getServiceMethod(request: Request) {
		const { serviceId, serviceMethod } = ServiceMethod.parse(request.method)!;
		const [ reflector, targetObj ] = this.services[serviceId];
		const method = reflector.getMethod(serviceMethod);
		return [ method, targetObj ];
	}

	public async handleRequest(request: Request, requestId: RequestId, token: CancellationToken): Promise<RequestResult<any, any>> {
		const [ method, targetObj ] = this.getServiceMethod(request)!;
		if (method.isOneWay) throw "Method must not be one way";

		const result = await method.call(targetObj, request.params);
		return { result, error: undefined };
	}

	public async handleNotification(request: Request, token: CancellationToken): Promise<void> {
		const [ serviceMethod, targetObj ] = this.getServiceMethod(request)!;
		if (!serviceMethod.isOneWay) throw "Method must be one way";

		serviceMethod.call(targetObj, request.params);
	}
}
