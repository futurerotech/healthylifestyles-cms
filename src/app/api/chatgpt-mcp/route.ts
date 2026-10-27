import { NextResponse } from 'next/server';
import { draftBridgeAuth } from '@/lib/chatgptDraftAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSION = '2025-06-18';
const noCache = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const tools = [
  { name: 'check_editorial_references', description: 'Look up currently published HealthyLifeStyles tools, articles, categories, authors and tags. Read-only.', inputSchema: { type: 'object', additionalProperties: false, properties: {} } },
  { name: 'check_article_slug', description: 'Find an existing HealthyLifeStyles article (draft or published) by exact slug before considering creation. Read-only.', inputSchema: { type: 'object', required: ['slug'], additionalProperties: false, properties: { slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' } } } },
  { name: 'create_article_draft', description: 'Create ONE unpublished HealthyLifeStyles article draft only after explicit user authorization and a prior duplicate check. Never retry on uncertain responses. Accepts the full article JSON object.', inputSchema: { type: 'object', required: ['article'], additionalProperties: false, properties: { article: { type: 'object', additionalProperties: true } } } },
];
const json = (value: unknown, status=200) => NextResponse.json(value,{status,headers:noCache});
function rpc(id: unknown, result: unknown) { return { jsonrpc: '2.0', id, result }; }
function err(id: unknown, code: number, message: string) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function authorized(req: Request) { return draftBridgeAuth(req.headers,process.env.CHATGPT_DRAFT_BRIDGE_TOKEN) === 'ok'; }
function toolResult(value: unknown, isError=false) { return { content: [{ type: 'text', text: JSON.stringify(value) }], isError }; }
async function perform(req: Request, name: string, args: Record<string,unknown>) {
  const url = new URL('/api/chatgpt-drafts',req.url);
  let method='GET',body: string|undefined;
  if(name==='check_editorial_references') url.searchParams.set('kind','references');
  else if(name==='check_article_slug') {
    if(typeof args.slug!=='string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) || args.slug.length>120) throw new Error('Invalid slug.');
    url.searchParams.set('kind','article');url.searchParams.set('slug',args.slug);
  } else if(name==='create_article_draft') {
    if(!args.article || typeof args.article!=='object'||Array.isArray(args.article)) throw new Error('Full article object required.');
    method='POST';body=JSON.stringify(args.article);
    if(body.length>180000) throw new Error('Article too large.');
  } else throw new Error('Unknown tool.');
  // Internal call uses only a server-held secret, never browser cookies.
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+process.env.CHATGPT_DRAFT_BRIDGE_TOKEN,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body,cache:'no-store'});
  let data:unknown;
  try { data=await response.json(); } catch { return toolResult({error:'Invalid CMS response',status:response.status},true); }
  return toolResult({status:response.status,data},!response.ok);
}
export async function POST(req:Request) {
  if(!authorized(req)) return json({error:'Unauthorized'},401);
  if(!req.headers.get('accept')?.includes('application/json')) return json({error:'Accept application/json required'},406);
  let raw:string;
  try {raw=await req.text();}catch{return json({error:'Invalid request'},400);}
  if(raw.length>200000) return json({error:'Request too large'},413);
  let msg:Record<string,unknown>;
  try {msg=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
  if(!msg||typeof msg!=='object'||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return json(err(msg?.id??null,-32600,'Invalid request'));
  const id=msg.id??null;
  if(msg.method==='notifications/initialized')return new Response(null,{status:202,headers:noCache});
  if(msg.method==='initialize')return json(rpc(id,{protocolVersion:VERSION,capabilities:{tools:{listChanged:false}},serverInfo:{name:'healthylifestyles-draft-only',version:'1.0.0'}}));
  if(msg.method==='ping')return json(rpc(id,{}));
  if(msg.method==='tools/list')return json(rpc(id,{tools}));
  if(msg.method==='tools/call') {
    const p=msg.params as Record<string,unknown>|undefined;
    const name=p?.name,args=p?.arguments;
    if(typeof name!=='string'||!tools.some(t=>t.name===name))return json(err(id,-32602,'Unknown tool'));
    if(args!==undefined&&(typeof args!=='object'||args===null||Array.isArray(args)))return json(err(id,-32602,'Invalid arguments'));
    try {return json(rpc(id,await perform(req,name,(args??{}) as Record<string,unknown>)));}
    catch(e){return json(rpc(id,toolResult({error:(e as Error).message},true)));}
  }
  return json(err(id,-32601,'Method not found'));
}
export async function GET(req:Request) {return authorized(req)?json({name:'healthylifestyles-draft-only',protocol:VERSION}):json({error:'Unauthorized'},401);}
export async function DELETE(req:Request) {return authorized(req)?new Response(null,{status:204,headers:noCache}):json({error:'Unauthorized'},401);}
