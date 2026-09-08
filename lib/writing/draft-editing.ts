import type { WritingResource } from "./contracts";
import type { DraftValues } from "./draft-contracts";
import { writingPatch, type WritingPatch } from "./revision-contracts";
export function resourceEditorValues(resource:WritingResource):DraftValues {
  return {title:resource.title,author:resource.author||"",audience:resource.audience||"",topics:resource.topics.join(", "),abstract:resource.abstract||"",
    body_text:resource.body_text,website_summary:resource.metadata.website_summary||"",seo_description:resource.metadata.seo_description||"",
    publication_state:resource.publication_state,reason:"",evidence:"Source: "+resource.source_label+" · revision "+resource.revision+". "};
}
export function patchFromWorkingDraft(resource:WritingResource,values:DraftValues):WritingPatch {
  const patch:WritingPatch={};
  for(const field of ["title","author","audience","abstract","body_text"] as const) {
    const raw=values[field]||"",value=["author","audience","abstract"].includes(field)?raw||null:raw;
    if(value!==resource[field])Object.assign(patch,{[field]:value});
  }
  const topics=(values.topics||"").split(",").map(v=>v.trim()).filter(Boolean);
  if(JSON.stringify(topics)!==JSON.stringify(resource.topics))patch.topics=topics;
  const metadata={...resource.metadata,website_summary:values.website_summary||"",seo_description:values.seo_description||""};
  if(metadata.website_summary!==(resource.metadata.website_summary||"")||metadata.seo_description!==(resource.metadata.seo_description||""))patch.metadata=metadata;
  if(values.publication_state!==resource.publication_state)patch.publication_state=values.publication_state as WritingPatch["publication_state"];
  return writingPatch.parse(patch);
}
