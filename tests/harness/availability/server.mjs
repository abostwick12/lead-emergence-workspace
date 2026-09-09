import {createServer} from "vite";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
export const server=await createServer({configFile:false,root:path.join(root,"tests/harness/availability"),
 server:{host:"127.0.0.1",port:3130,strictPort:true,fs:{allow:[root]}},
 resolve:{alias:[{find:"@",replacement:root}]},esbuild:{jsx:"automatic"},
 define:{"process.env.NEXT_PUBLIC_SUPABASE_URL":"undefined","process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":"undefined"}});
await server.listen();
console.log("Isolated Executive component test: http://127.0.0.1:3130 — no accounts, API simulation or database.");
