import {readFile} from "node:fs/promises";
import {localConfiguration,localSql} from "./bundle-local-runtime.mjs";
await localConfiguration();
const version="20260913120000";
if(localSql("select count(*) from supabase_migrations.schema_migrations where version='"+version+"'").trim()!=="0")throw Error("Connection migration is already applied; do not replay it.");
const sql=await readFile("supabase/migrations/"+version+"_workspace_connection_center.sql","utf8");
localSql("begin;\n"+sql+"\ninsert into supabase_migrations.schema_migrations(version,name) values('"+version+"','workspace_connection_center');\ncommit;\nnotify pgrst,'reload schema';");
console.log("Applied migration 37 to the isolated local fixture database only.");
