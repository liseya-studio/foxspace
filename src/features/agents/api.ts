import type {ApiRequest,ApiResponse} from "./data";
/** Transport is injected by a future authenticated desktop/server adapter. No secrets are persisted by this module. */
export interface FoxSpaceTransport { request<T>(request:ApiRequest):Promise<ApiResponse<T>>; }
export class FoxSpaceApi {
 constructor(private readonly transport:FoxSpaceTransport){}
 read<T>(path:string,actorId="user"){return this.transport.request<T>({method:"GET",path,requestId:crypto.randomUUID(),actorId,capability:"read"});}
 create<T>(path:string,body:unknown,actorId:string){return this.transport.request<T>({method:"POST",path,body,requestId:crypto.randomUUID(),actorId,capability:"write"});}
 update<T>(path:string,body:unknown,actorId:string){return this.transport.request<T>({method:"PATCH",path,body,requestId:crypto.randomUUID(),actorId,capability:"write"});}
 remove<T>(path:string,actorId:string){return this.transport.request<T>({method:"DELETE",path,requestId:crypto.randomUUID(),actorId,capability:"delete"});}
}
export type IntegrationProvider="github"|"railway"|"telegram"|"vk"|"youtube"|"tiktok"|"boosty";
export type IntegrationState={provider:IntegrationProvider;connected:boolean;accountLabel?:string;lastSyncAt?:string;scopes:string[];status:"disconnected"|"connected"|"error"|"needs_reauth"};
/** Provider adapters must request minimum scopes and keep credentials in OS keychain/server secret storage. */
export interface IntegrationAdapter { readonly provider:IntegrationProvider; connect():Promise<IntegrationState>; disconnect():Promise<void>; getState():Promise<IntegrationState>; }
