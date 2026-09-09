import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {server} from "./server.mjs";
try{
 const cli=fileURLToPath(new URL("../../../node_modules/@playwright/test/cli.js",import.meta.url));
 process.exitCode=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[cli,"test","--config","playwright.availability.config.ts",...process.argv.slice(2)],{stdio:"inherit"});
  child.once("error",reject);child.once("exit",(code,signal)=>resolve(code??(signal?1:0)));
 });
}finally{await server.close();}
