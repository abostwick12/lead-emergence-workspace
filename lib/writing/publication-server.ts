import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {publicationContext,publicationInput,preparePublication} from "./publication";
import {writingPreparationError} from "./profile-server";
export async function getPublicationPacket(client:SupabaseClient<any,any,any,any,any>,raw:unknown){
 const i=publicationInput.parse(raw),{data,error}=await client.rpc("writer_publication_context",{resource_id:i.resourceId,expected_revision:i.expectedRevision});
 writingPreparationError(error);return preparePublication(publicationContext.parse(data));
}
