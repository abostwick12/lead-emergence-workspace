import { createServer } from 'vite'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({configFile:false,plugins:[{name:'synthetic-api',configureServer(instance){instance.middlewares.use(handleRequest);}}],root:path.join(root,'tests/harness'),server:{host:'127.0.0.1',port:3110,strictPort:true,fs:{allow:[root]}},resolve:{alias:[{find:'@/lib/supabase/client',replacement:path.join(root,'tests/harness/session.ts')},{find:'@',replacement:root}]},esbuild:{jsx:'automatic'}});
const {SotfStore}=await server.ssrLoadModule(path.join(root,'lib/sotf/persistence.ts'));
const batch={workspace_id:'70000000-0000-4000-8000-000000000001',revision:0,events:[]};let loseNextReply=false;
const store=new SotfStore({async read(){return structuredClone(batch)},async append(envelope){if(envelope.expectedRevision!==batch.revision)throw new Error('Stale synthetic operation');batch.revision++;batch.events.push({revision:batch.revision,envelope,recorded_at:new Date().toISOString()});return {revision:batch.revision};}});
async function handleRequest(req,res,next){
  if(req.url==='/__test/reset' && req.method==='POST'){batch.revision=0;batch.events=[];loseNextReply=false;res.end('reset');return;}
  if(req.url==='/__test/lose-next-reply' && req.method==='POST'){loseNextReply=true;res.end('armed');return;}
  if(req.url!=='/api/sotf'){next();return;}
  if(req.headers.authorization!=='Bearer synthetic-local-session'){res.statusCode=401;res.end('{}');return;}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  try{let result;if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);result=await store.execute(JSON.parse(Buffer.concat(chunks).toString()));if(loseNextReply){loseNextReply=false;res.statusCode=503;res.end(JSON.stringify({saved:null,message:'The change may have been saved; its acknowledgement could not be verified.'}));return;}}else result=await store.read();res.end(JSON.stringify(result));}catch(error){res.statusCode=400;res.end(JSON.stringify({saved:null,message:error.message}));}
}await server.listen();console.log('Synthetic connected component acceptance: http://127.0.0.1:3110');
