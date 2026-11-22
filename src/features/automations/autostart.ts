import { isTauri } from "@tauri-apps/api/core";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
export async function getAutoLaunchState():Promise<boolean|null>{if(!isTauri())return null;try{return await isEnabled();}catch{return false;}}
export async function setAutoLaunchState(value:boolean):Promise<boolean>{if(!isTauri())return false;if(value)await enable();else await disable();return isEnabled();}
