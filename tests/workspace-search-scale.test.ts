import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const before=readFileSync("supabase/migrations/20260912120000_workspace_saved_search.sql","utf8").replaceAll("\r\n","\n");
const after=readFileSync("supabase/migrations/20260912140000_workspace_search_page_previews.sql","utf8").replaceAll("\r\n","\n");
describe("page-bound native search previews",()=>{
 it("retains the exact native access and input guards",()=>{
  const guard=(sql:string)=>sql.slice(sql.indexOf("declare target uuid:=workspace_private.require_search_workspace(); current_revision"),sql.indexOf(" query:=websearch_to_tsquery"));
  expect(guard(before)).toContain("Search scope unavailable.");
  expect(guard(before)).toContain("Choose a valid query and search scope.");
  expect(guard(after)).toBe(guard(before));
 });
 it("materializes complete metadata matches, not bodies, JSON or vectors",()=>{
  const matches=after.slice(after.indexOf("), matches as materialized"),after.indexOf("), page as materialized"));
  expect(matches).toContain("select provider_id,id,title,revision,updated_at,bundle_key,kind,");
  expect(matches).not.toMatch(/select \*|plain_text|body_text|r\.data/);
  expect(after).toContain("'matchingCount',(select count(*) from matches)");
  expect(after).toContain("count(*) from matches m where m.provider_id=p.id");
 });
 it("selects the bounded ranked page before preparing original text",()=>{
  expect(after).toContain("limit 25 offset p_offset");
  expect(after.indexOf("limit 25 offset p_offset")).toBeLessThan(after.indexOf("), previews as"));
  const preview=after.slice(after.indexOf("), previews as"),after.indexOf("\n select jsonb_build_object"));
  expect(preview.match(/r.workspace_id=target and r.id=p.id/g)).toHaveLength(5);
  expect(preview.match(/and r.kind=p.kind/g)).toHaveLength(4);
  expect(preview).toContain("end as plain_text from page p");
 });
 it("changes no tables, assignments, sharing controls or function grants",()=>{
  expect(after).not.toMatch(/create table|insert into|delete from|update workspace/);
  expect(after).toContain("revoke all on function workspace.search_saved_work(text,text[],text,integer) from public,anon,authenticated");
 });
});
