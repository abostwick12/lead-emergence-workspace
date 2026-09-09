import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {BundleApiError} from "@/lib/workspace/bundle-server";
import {profileHistory,profileResult,profileSaveInput} from "./profile-contracts";
type Client=SupabaseClient<any,any,any,any,any>;
export function writingPreparationError(error:{code?:string}|null){
 if(!error)return;
 throw new BundleApiError(error.code==="40001"?"The saved version changed. Your work was not applied; reload and review the latest version.":error.code==="42501"?"Writing access is unavailable or this action requires your own confirmation in Workspace.":error.code==="P0002"?"Resource unavailable.":error.code==="22023"?"Check the fields and confirm the exact preferences.":"Writing preparation is temporarily unavailable. Please retry.",
 error.code==="40001"?409:error.code==="42501"?403:error.code==="P0002"?404:error.code==="22023"?400:503);
}
export async function getWritingProfile(client:Client){const {data,error}=await client.rpc("writer_get_profile");writingPreparationError(error);return profileResult.parse(data);}
export async function saveWritingProfile(client:Client,raw:unknown){
 const input=profileSaveInput.parse(raw),{data,error}=await client.rpc("writer_save_profile",{expected_revision:input.expectedRevision,request_id:input.requestId,profile_input:input.profile,confirm_preferences:input.confirmPreferences});
 writingPreparationError(error);return profileResult.parse(data);
}
export async function getWritingProfileHistory(client:Client){const {data,error}=await client.rpc("writer_get_profile_history");writingPreparationError(error);return profileHistory.parse(data);}
