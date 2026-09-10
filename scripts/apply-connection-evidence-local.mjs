import {readFile} from "node:fs/promises";
import {localConfiguration,localSql} from "./bundle-local-runtime.mjs";
await localConfiguration();const version="20260913130000";
if(localSql("select count(*) from supabase_migrations.schema_migrations where version='"+version+"'").trim()!=="0")throw Error("Evidence migration already applied.");
localSql("begin;\n"+await readFile("supabase/migrations/"+version+"_connection_review_evidence.sql","utf8")+"\ninsert into supabase_migrations.schema_migrations(version,name) values('"+version+"','connection_review_evidence');commit;notify pgrst,'reload schema';");
console.log("Applied activity-stable authorization fingerprints only to the isolated local database.");
