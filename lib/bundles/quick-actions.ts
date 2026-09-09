import type {BaseBundleExperience} from "./experience";
// Implemented native handlers, not a promise that every planned workflow runs.
// Routes open a chooser or an unsaved editor. Domain pages enforce access again.
const handlers:Record<string,{label:string;description:string;route:string;required?:string[]}>={
 "writer.workflow.resource_review":{label:"Choose a resource to review",description:"Open your saved Writing library.",route:"/workspace/writing/library",required:["writer.resource.library"]},
 "ministry.workflow.research_brief":{label:"Start passage research",description:"Open a new Ministry research draft.",route:"/workspace/ministry/research/new"},
 "nonprofit.workflow.next_moves":{label:"Review founder next moves",description:"Open your Founder workspace and recorded next actions.",route:"/workspace/nonprofit"},
 "investor.workflow.thesis_review":{label:"Choose an investment thesis",description:"Open saved theses for evidence-led review.",route:"/workspace/investing/thesis"},
 "executive.workflow.daily_brief":{label:"Start a daily brief",description:"Open an unsaved Executive brief.",route:"/workspace/executive/daily_brief/new"},
 "executive.workflow.commitment":{label:"New commitment",description:"Capture an owner, outcome and next action.",route:"/workspace/executive/commitment/new"},
 "executive.workflow.decision":{label:"New decision",description:"Record a decision and its reasoning.",route:"/workspace/executive/decision/new"},
 "executive.workflow.meeting":{label:"New meeting plan",description:"Draft an agenda; no invitation is sent.",route:"/workspace/executive/meeting/new"},
 "executive.workflow.weekly_review":{label:"Start a weekly review",description:"Open an unsaved Executive review.",route:"/workspace/executive/weekly_review/new"}
};
export type NativeQuickAction={id:string;label:string;description:string;route:string;bundleKey:string};
export function nativeQuickActions(experience:BaseBundleExperience):NativeQuickAction[]{
 const allowed=new Set(experience.capabilityIds);
 const actions=experience.ui.commandPaletteActions.flatMap(item=>{
  const handler=handlers[item.workflowId];
  return handler && allowed.has(item.capabilityId) && (handler.required??[]).every(id=>allowed.has(id))
   ? [{id:item.id,label:handler.label,description:handler.description,route:handler.route,bundleKey:item.sourceBundleKey}]:[];
 });
 // The manual editor is deliberately not the planned AI-layout recommendation.
 if(allowed.has("workspace.personalize"))actions.push({id:"native.layout",label:"Customize workspace layout",description:"Preview and confirm your own pins, order and starting page.",route:"/workspace/layout",bundleKey:"workspace_experience"});
 return actions;
}
