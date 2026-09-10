import {readFile} from "node:fs/promises";
import {localConfiguration,localSql} from "./bundle-local-runtime.mjs";
await localConfiguration();
const version="20260913123000";
if(localSql("select count(*) from supabase_migrations.schema_migrations where version='"+version+"'").trim()!=="0")throw Error("Serialization migration already applied.");
localSql("begin;\n"+await readFile("supabase/migrations/"+version+"_connection_consent_serialization.sql","utf8")+"\ninsert into supabase_migrations.schema_migrations(version,name) values('"+version+"','connection_consent_serialization');commit;notify pgrst,'reload schema';");
console.log("Applied consent/revocation serialization only to the isolated local database.");
