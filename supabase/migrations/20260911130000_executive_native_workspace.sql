-- Executive native coordination. Catalog only: no client assignment, scheduler,
-- external provider connection, hosted operation or notification is created.
-- Generated base schemas are trusted source literals, never caller-supplied schemas.
create function workspace_private.executive_schema(p_kind text) returns jsonb
language sql immutable set search_path='' as $$
 select case p_kind
 when 'commitment' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"notes":{"type":"string","maxLength":12000},"priority":{"type":"string","enum":["high","normal","low"]},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"references":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"capabilityId":{"type":"string","enum":["executive.coordination","executive.brief","executive.review","writer.resource.library","ministry.research","ministry.archive","nonprofit.roadmap","nonprofit.partners","nonprofit.meetings","nonprofit.regulatory_research","investor.company_research","investor.thesis","investor.filings"]},"kind":{"type":"string","minLength":1,"maxLength":40},"documentId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"revision":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991}},"required":["capabilityId","kind","documentId","revision"],"additionalProperties":false}},"recordType":{"type":"string","const":"commitment"},"state":{"type":"string","enum":["open","waiting","blocked","completed","cancelled"]},"owner":{"type":"string","maxLength":240},"outcome":{"type":"string","minLength":1,"maxLength":4000},"nextAction":{"type":"string","maxLength":2000},"dueDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"followupDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"completedOn":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"blocker":{"type":"string","maxLength":2000}},"required":["title","notes","priority","reviewState","reviewDate","references","recordType","state","owner","outcome","nextAction","dueDate","followupDate","completedOn","blocker"],"additionalProperties":false}$schema$::jsonb
 when 'decision' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"notes":{"type":"string","maxLength":12000},"priority":{"type":"string","enum":["high","normal","low"]},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"references":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"capabilityId":{"type":"string","enum":["executive.coordination","executive.brief","executive.review","writer.resource.library","ministry.research","ministry.archive","nonprofit.roadmap","nonprofit.partners","nonprofit.meetings","nonprofit.regulatory_research","investor.company_research","investor.thesis","investor.filings"]},"kind":{"type":"string","minLength":1,"maxLength":40},"documentId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"revision":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991}},"required":["capabilityId","kind","documentId","revision"],"additionalProperties":false}},"recordType":{"type":"string","const":"decision"},"state":{"type":"string","enum":["open","decided","deferred","reversed"]},"question":{"type":"string","minLength":1,"maxLength":4000},"owner":{"type":"string","maxLength":240},"dueDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"nextAction":{"type":"string","maxLength":2000},"options":{"maxItems":12,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":240},"upside":{"type":"string","maxLength":2000},"downside":{"type":"string","maxLength":2000},"evidence":{"type":"string","maxLength":4000}},"required":["id","title","upside","downside","evidence"],"additionalProperties":false}},"selectedOptionId":{"anyOf":[{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},{"type":"null"}]},"decidedOn":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"rationale":{"type":"string","maxLength":4000},"revisitTrigger":{"type":"string","maxLength":2000}},"required":["title","notes","priority","reviewState","reviewDate","references","recordType","state","question","owner","dueDate","nextAction","options","selectedOptionId","decidedOn","rationale","revisitTrigger"],"additionalProperties":false}$schema$::jsonb
 when 'meeting' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"notes":{"type":"string","maxLength":12000},"priority":{"type":"string","enum":["high","normal","low"]},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"references":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"capabilityId":{"type":"string","enum":["executive.coordination","executive.brief","executive.review","writer.resource.library","ministry.research","ministry.archive","nonprofit.roadmap","nonprofit.partners","nonprofit.meetings","nonprofit.regulatory_research","investor.company_research","investor.thesis","investor.filings"]},"kind":{"type":"string","minLength":1,"maxLength":40},"documentId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"revision":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991}},"required":["capabilityId","kind","documentId","revision"],"additionalProperties":false}},"recordType":{"type":"string","const":"meeting"},"state":{"type":"string","enum":["planned","held","cancelled"]},"objective":{"type":"string","minLength":1,"maxLength":4000},"participants":{"maxItems":30,"type":"array","items":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":240},"role":{"type":"string","maxLength":240}},"required":["name","role"],"additionalProperties":false}},"agenda":{"type":"string","maxLength":8000},"startsAt":{"anyOf":[{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},{"type":"null"}]},"timeZone":{"type":"string","minLength":1,"maxLength":100},"durationMinutes":{"type":"integer","minimum":5,"maximum":480},"agreement":{"type":"string","enum":["not_agreed","user_reported_agreed"]},"location":{"type":"string","maxLength":1000},"outcome":{"type":"string","maxLength":8000},"actions":{"maxItems":30,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":240},"owner":{"type":"string","maxLength":240},"dueDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"state":{"type":"string","enum":["open","waiting","blocked","completed","cancelled"]},"nextAction":{"type":"string","maxLength":2000},"evidence":{"type":"string","maxLength":2000},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]}},"required":["id","title","owner","dueDate","state","nextAction","evidence","reviewState"],"additionalProperties":false}}},"required":["title","notes","priority","reviewState","reviewDate","references","recordType","state","objective","participants","agenda","startsAt","timeZone","durationMinutes","agreement","location","outcome","actions"],"additionalProperties":false}$schema$::jsonb
 when 'daily_brief' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"notes":{"type":"string","maxLength":12000},"priority":{"type":"string","enum":["high","normal","low"]},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"references":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"capabilityId":{"type":"string","enum":["executive.coordination","executive.brief","executive.review","writer.resource.library","ministry.research","ministry.archive","nonprofit.roadmap","nonprofit.partners","nonprofit.meetings","nonprofit.regulatory_research","investor.company_research","investor.thesis","investor.filings"]},"kind":{"type":"string","minLength":1,"maxLength":40},"documentId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"revision":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991}},"required":["capabilityId","kind","documentId","revision"],"additionalProperties":false}},"recordType":{"type":"string","const":"daily_brief"},"state":{"type":"string","enum":["draft","reviewed","archived"]},"periodStart":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"periodEnd":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"focus":{"type":"string","minLength":1,"maxLength":2000},"summary":{"type":"string","maxLength":8000},"observations":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"text":{"type":"string","minLength":1,"maxLength":3000},"classification":{"type":"string","enum":["observation","interpretation","suggestion"]},"evidence":{"type":"string","minLength":1,"maxLength":2000},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]}},"required":["id","text","classification","evidence","reviewState"],"additionalProperties":false}},"actions":{"maxItems":10,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":240},"owner":{"type":"string","maxLength":240},"dueDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"state":{"type":"string","enum":["open","waiting","blocked","completed","cancelled"]},"nextAction":{"type":"string","maxLength":2000},"evidence":{"type":"string","maxLength":2000},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]}},"required":["id","title","owner","dueDate","state","nextAction","evidence","reviewState"],"additionalProperties":false}},"reflection":{"type":"string","maxLength":8000}},"required":["title","notes","priority","reviewState","reviewDate","references","recordType","state","periodStart","periodEnd","focus","summary","observations","actions","reflection"],"additionalProperties":false}$schema$::jsonb
 when 'weekly_review' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"notes":{"type":"string","maxLength":12000},"priority":{"type":"string","enum":["high","normal","low"]},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"references":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"capabilityId":{"type":"string","enum":["executive.coordination","executive.brief","executive.review","writer.resource.library","ministry.research","ministry.archive","nonprofit.roadmap","nonprofit.partners","nonprofit.meetings","nonprofit.regulatory_research","investor.company_research","investor.thesis","investor.filings"]},"kind":{"type":"string","minLength":1,"maxLength":40},"documentId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"revision":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991}},"required":["capabilityId","kind","documentId","revision"],"additionalProperties":false}},"recordType":{"type":"string","const":"weekly_review"},"state":{"type":"string","enum":["draft","reviewed","archived"]},"periodStart":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"periodEnd":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"focus":{"type":"string","minLength":1,"maxLength":2000},"summary":{"type":"string","maxLength":8000},"observations":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"text":{"type":"string","minLength":1,"maxLength":3000},"classification":{"type":"string","enum":["observation","interpretation","suggestion"]},"evidence":{"type":"string","minLength":1,"maxLength":2000},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]}},"required":["id","text","classification","evidence","reviewState"],"additionalProperties":false}},"actions":{"maxItems":10,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":240},"owner":{"type":"string","maxLength":240},"dueDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"state":{"type":"string","enum":["open","waiting","blocked","completed","cancelled"]},"nextAction":{"type":"string","maxLength":2000},"evidence":{"type":"string","maxLength":2000},"reviewState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]}},"required":["id","title","owner","dueDate","state","nextAction","evidence","reviewState"],"additionalProperties":false}},"reflection":{"type":"string","maxLength":8000}},"required":["title","notes","priority","reviewState","reviewDate","references","recordType","state","periodStart","periodEnd","focus","summary","observations","actions","reflection"],"additionalProperties":false}$schema$::jsonb
 else null end;
$$;
insert into workspace.bundle_definitions(bundle_key,display_name,description)
values('executive','Executive','Evidence-linked commitments, decisions, meeting plans and reviews.') on conflict do nothing;
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('executive_coordination','Executive coordination','Follow through on commitments, decisions and meeting plans with explicit source permissions.'),
 ('executive_brief','Executive daily brief','Prepare a bounded, evidence-linked daily operating brief.'),
 ('executive_review','Executive weekly review','Review recorded outcomes, open commitments and next moves.')
on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key)
select 'executive',x from unnest(array['executive_coordination','executive_brief','executive_review']) x on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
 ('executive','executive_coordination','executive.coordination'),
 ('executive','executive_brief','executive.brief'),('executive','executive_review','executive.review') on conflict do nothing;

create table workspace_private.executive_documents(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 kind text not null check(kind in ('commitment','decision','meeting','daily_brief','weekly_review')),revision integer not null check(revision>0),data jsonb not null,
 origin text not null check(origin in ('user','assistant')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 search_vector tsvector generated always as (jsonb_to_tsvector('simple'::regconfig,data,'["string"]'::jsonb)) stored,unique(workspace_id,id)
);
create index executive_document_search on workspace_private.executive_documents using gin(search_vector);
create index executive_document_list on workspace_private.executive_documents(workspace_id,kind,updated_at desc,id);
create table workspace_private.executive_versions(
 workspace_id uuid not null,document_id uuid not null,revision integer not null,kind text not null,data jsonb not null,
 origin text not null,created_at timestamptz not null,updated_at timestamptz not null,
 request_id uuid not null,base_document_id uuid,base_revision integer not null,recorded_by uuid not null references auth.users(id),
 primary key(document_id,revision),unique(workspace_id,request_id),
 foreign key(workspace_id,document_id) references workspace_private.executive_documents(workspace_id,id) on delete cascade
);
create table workspace_private.executive_proposals(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 kind text not null check(kind in ('commitment','decision','meeting','daily_brief','weekly_review')),document_id uuid,base_revision integer not null check(base_revision>=0),
 data jsonb not null,reason text not null,evidence text not null,origin text not null check(origin in ('user','assistant')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),
 request_id uuid not null,applied_document_id uuid,applied_revision integer,decided_by uuid references auth.users(id),decided_at timestamptz,
 unique(workspace_id,request_id),foreign key(workspace_id,document_id) references workspace_private.executive_documents(workspace_id,id) on delete cascade,
 foreign key(workspace_id,applied_document_id) references workspace_private.executive_documents(workspace_id,id) on delete cascade,
 check((document_id is null and base_revision=0) or (document_id is not null and base_revision>0))
);
create index executive_proposal_queue on workspace_private.executive_proposals(workspace_id,kind,status,created_at,id);
alter table workspace_private.executive_documents enable row level security;
alter table workspace_private.executive_versions enable row level security;
alter table workspace_private.executive_proposals enable row level security;
revoke all on workspace_private.executive_documents,workspace_private.executive_versions,workspace_private.executive_proposals from public,anon,authenticated;

create function workspace_private.executive_capability(p_kind text) returns text
language sql immutable set search_path='' as $$
 select case p_kind when 'commitment' then 'executive.coordination' when 'decision' then 'executive.coordination' when 'meeting' then 'executive.coordination' when 'daily_brief' then 'executive.brief' when 'weekly_review' then 'executive.review' end;
$$;
create function workspace_private.require_executive(p_kind text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace(); capability text:=workspace_private.executive_capability(p_kind);
begin
 if capability is null then raise exception 'Choose an Executive record type.' using errcode='22023'; end if;
 if not workspace_private.bundle_capability_active(target,'executive',capability) then raise exception 'Executive access is unavailable.' using errcode='42501'; end if;
 return target;
end; $$;
create function workspace_private.executive_direct_user() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Review and confirm this change yourself in Workspace.' using errcode='42501';
 end if;
end; $$;

create function workspace_private.executive_date(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare raw text:=p_value#>>'{}'; d date;
begin
 if p_value='null'::jsonb then return; end if;
 if jsonb_typeof(p_value) is distinct from 'string' or raw!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid Executive date.' using errcode='22023'; end if;
 begin d:=raw::date; exception when others then raise exception 'Invalid Executive date.' using errcode='22023'; end;
 if to_char(d,'YYYY-MM-DD')<>raw then raise exception 'Invalid Executive date.' using errcode='22023'; end if;
end; $$;
-- This bounded evaluator implements only the generated base-schema keywords.
-- It never accepts a schema supplied by a caller or fetches a referenced URL.
create function workspace_private.executive_validate_node(p_value jsonb,p_schema jsonb,p_depth integer default 0) returns void
language plpgsql immutable set search_path='' as $$
declare child jsonb; entry record; valid boolean:=false; raw text:=p_value#>>'{}'; n numeric; width integer; port_value text;
begin
 if p_depth>14 or p_value is null or p_schema is null then raise exception 'Invalid Executive structure.' using errcode='22023'; end if;
 if p_schema ? 'anyOf' then
  for child in select * from jsonb_array_elements(p_schema->'anyOf') loop
   begin perform workspace_private.executive_validate_node(p_value,child,p_depth+1); valid:=true; exit;
   exception when sqlstate '22023' then null; end;
  end loop;
  if not valid then raise exception 'Invalid Executive value.' using errcode='22023'; end if;
  return;
 end if;
 if jsonb_typeof(p_value) is distinct from (case when p_schema->>'type'='integer' then 'number' else p_schema->>'type' end) then raise exception 'Invalid Executive field type.' using errcode='22023'; end if;
 if p_schema ? 'const' and p_value<>p_schema->'const' then raise exception 'Invalid Executive constant.' using errcode='22023'; end if;
 if p_schema ? 'enum' and not exists(select 1 from jsonb_array_elements(p_schema->'enum') e where e=p_value) then raise exception 'Invalid Executive option.' using errcode='22023'; end if;
 if p_schema->>'type'='object' then
  if exists(select 1 from jsonb_object_keys(p_value) k where not(p_schema->'properties' ? k))
   or exists(select 1 from jsonb_array_elements_text(p_schema->'required') k where not(p_value ? k)) then raise exception 'Unknown or missing Executive field.' using errcode='22023'; end if;
  for entry in select * from jsonb_each(p_value) loop perform workspace_private.executive_validate_node(entry.value,p_schema->'properties'->entry.key,p_depth+1); end loop;
 elsif p_schema->>'type'='array' then
  if jsonb_array_length(p_value)>coalesce((p_schema->>'maxItems')::integer,100) or jsonb_array_length(p_value)<coalesce((p_schema->>'minItems')::integer,0) then raise exception 'Executive list is too long.' using errcode='22023'; end if;
  for child in select * from jsonb_array_elements(p_value) loop perform workspace_private.executive_validate_node(child,p_schema->'items',p_depth+1); end loop;
 elsif p_schema->>'type'='string' then
  -- Match JavaScript string limits, counting a non-BMP character as two code units.
  width:=char_length(raw)+char_length(regexp_replace(raw,U&'[\0001-\FFFF]','','g'));
  if width>coalesce((p_schema->>'maxLength')::integer,100000)
   or (p_schema ? 'minLength' and (char_length(btrim(raw))<(p_schema->>'minLength')::integer)) then raise exception 'Executive text is empty or too long.' using errcode='22023'; end if;
  if p_schema ? 'pattern' and raw !~ (p_schema->>'pattern') then raise exception 'Invalid Executive text format.' using errcode='22023'; end if;
  if p_schema->>'format'='date' then perform workspace_private.executive_date(p_value);
  elsif p_schema->>'format'='date-time' then
   begin perform raw::timestamptz; exception when others then raise exception 'Invalid Executive retrieval timestamp.' using errcode='22023'; end;
  elsif p_schema->>'format'='uri' then
   if raw !~ '^https?://([A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    then raise exception 'Use an HTTP(S) Executive source without credentials.' using errcode='22023'; end if;
   port_value:=substring(raw from '^https?://[^/?#]*:([0-9]+)(?:[/?#]|$)');
   if port_value is not null and port_value::integer>65535 then raise exception 'Invalid source port.' using errcode='22023'; end if;
  end if;
 elsif p_schema->>'type' in ('number','integer') then
  n:=raw::numeric;
  if p_schema->>'type'='integer' and n<>trunc(n) then raise exception 'Use a whole number.' using errcode='22023'; end if;
  if (p_schema ? 'minimum' and n<(p_schema->>'minimum')::numeric) or (p_schema ? 'maximum' and n>(p_schema->>'maximum')::numeric) then raise exception 'Executive number is outside its bounds.' using errcode='22023'; end if;
 end if;
end; $$;


create function workspace_private.executive_source_definition(p_capability text) returns jsonb
language sql immutable set search_path='' as $$
 select $sources${"writer.resource.library":{"bundleKey":"writer_editor","kinds":["resource"],"label":"Writing resource status"},"ministry.research":{"bundleKey":"ministry","kinds":["research"],"label":"Ministry research dates"},"ministry.archive":{"bundleKey":"ministry","kinds":["archive"],"label":"Ministry teaching dates"},"nonprofit.roadmap":{"bundleKey":"nonprofit_founder","kinds":["plan"],"label":"Nonprofit roadmap tasks"},"nonprofit.partners":{"bundleKey":"nonprofit_founder","kinds":["partner"],"label":"Nonprofit follow-up dates"},"nonprofit.meetings":{"bundleKey":"nonprofit_founder","kinds":["meeting"],"label":"Nonprofit meeting dates"},"nonprofit.regulatory_research":{"bundleKey":"nonprofit_founder","kinds":["research"],"label":"Nonprofit research review dates"},"investor.company_research":{"bundleKey":"investor","kinds":["watchlist","brief"],"label":"Investor watchlist and brief review dates"},"investor.thesis":{"bundleKey":"investor","kinds":["thesis"],"label":"Investor thesis review dates"},"investor.filings":{"bundleKey":"investor","kinds":["filing"],"label":"Investor filing review dates"}}$sources$::jsonb->p_capability;
$$;
create function workspace_private.executive_reference_matches(p_ref jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(workspace_private.executive_capability(p_ref->>'kind')=p_ref->>'capabilityId',false)
 or coalesce(workspace_private.executive_source_definition(p_ref->>'capabilityId')->'kinds' ? (p_ref->>'kind'),false);
$$;
create function workspace_private.validate_executive(p_kind text,p_data jsonb) returns void
language plpgsql stable set search_path='' as $$
declare collection text; v jsonb; days integer;
begin
 if p_data is null or octet_length(p_data::text)>400000 then raise exception 'Executive record is empty or too large.' using errcode='22023'; end if;
 perform workspace_private.executive_validate_node(p_data,workspace_private.executive_schema(p_kind));
 foreach collection in array array['options','observations','actions'] loop
  if p_data ? collection and
   (select count(distinct lower(x->>'id')) from jsonb_array_elements(p_data->collection) x)<>jsonb_array_length(p_data->collection)
   then raise exception 'Repeated Executive item identifier.' using errcode='22023'; end if;
 end loop;
 if (select count(distinct (x->>'capabilityId')||':'||(x->>'kind')||':'||lower(x->>'documentId')) from jsonb_array_elements(p_data->'references') x)
  <>jsonb_array_length(p_data->'references') then raise exception 'Link each source record once.' using errcode='22023'; end if;
 for v in select * from jsonb_array_elements(p_data->'references') loop
  if not workspace_private.executive_reference_matches(v) then raise exception 'Source kind and capability do not match.' using errcode='22023'; end if;
 end loop;
 if p_kind='commitment' then
  if ((p_data->>'state')='completed')<>(p_data->>'completedOn' is not null)
   then raise exception 'Only completed commitments require a completion date.' using errcode='22023'; end if;
  if p_data->>'state'='blocked' and btrim(p_data->>'blocker')='' then raise exception 'Record the blocker.' using errcode='22023'; end if;
 elsif p_kind='decision' then
  if p_data->>'selectedOptionId' is not null and not exists(select 1 from jsonb_array_elements(p_data->'options') x where lower(x->>'id')=lower(p_data->>'selectedOptionId'))
   then raise exception 'Choose an option in this decision.' using errcode='22023'; end if;
  if p_data->>'state' in ('decided','reversed') and (p_data->>'selectedOptionId' is null or p_data->>'decidedOn' is null or btrim(p_data->>'rationale')='')
   then raise exception 'Record the chosen option, date and rationale.' using errcode='22023'; end if;
  if p_data->>'state'='open' and (p_data->>'selectedOptionId' is not null or p_data->>'decidedOn' is not null)
   then raise exception 'An open decision is not decided.' using errcode='22023'; end if;
 elsif p_kind='meeting' then
  if not exists(select 1 from pg_timezone_names where name=p_data->>'timeZone')
   then raise exception 'Use a supported named time zone.' using errcode='22023'; end if;
  if p_data->>'agreement'='user_reported_agreed' and p_data->>'startsAt' is null
   then raise exception 'An agreed time needs an explicit instant.' using errcode='22023'; end if;
  if p_data->>'state'='held' and (p_data->>'startsAt' is null or btrim(p_data->>'outcome')='')
   then raise exception 'A held meeting needs its time and outcome.' using errcode='22023'; end if;
 else
  days:=(p_data->>'periodEnd')::date-(p_data->>'periodStart')::date;
  if (p_kind='daily_brief' and days<>0) or (p_kind='weekly_review' and days not between 0 and 6)
   then raise exception 'Use one daily date or at most seven inclusive review dates.' using errcode='22023'; end if;
 end if;
end; $$;
create function workspace_private.normalize_executive(p_data jsonb,p_base jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_data; collection text; items jsonb; v jsonb; previous jsonb; same_refs boolean:=p_data->'references' is not distinct from p_base->'references';
begin
 if p_data is not distinct from p_base then return result; end if;
 result:=jsonb_set(result,'{reviewState}','"inferred"');
 foreach collection in array array['actions','observations'] loop
  if result ? collection then
   items:='[]';
   for v in select * from jsonb_array_elements(result->collection) loop
    select x into previous from jsonb_array_elements(coalesce(p_base->collection,'[]')) x where lower(x->>'id')=lower(v->>'id');
    items:=items||jsonb_build_array(case when same_refs and v is not distinct from previous then v else jsonb_set(v,'{reviewState}','"inferred"') end);
   end loop;
   result:=jsonb_set(result,array[collection],items);
  end if;
 end loop;
 if p_data->>'recordType' in ('daily_brief','weekly_review') and p_data->>'state'='reviewed'
  then result:=jsonb_set(result,'{state}','"draft"'); end if;
 if p_data->>'recordType'='meeting' and p_data->>'agreement'='user_reported_agreed'
  and (p_base is null or p_base->>'recordType'<>'meeting' or p_data->'startsAt' is distinct from p_base->'startsAt'
   or p_data->'durationMinutes' is distinct from p_base->'durationMinutes' or p_data->'timeZone' is distinct from p_base->'timeZone'
   or p_data->'participants' is distinct from p_base->'participants')
  then result:=jsonb_set(result,'{agreement}','"not_agreed"'); end if;
 return result;
end; $$;
-- Executive validation complete.

create table workspace_private.executive_source_permissions(
 workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
 revision integer not null check(revision>0),source_capabilities text[] not null default '{}',
 updated_at timestamptz not null default now()
);
create table workspace_private.executive_source_permission_versions(
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 revision integer not null,base_revision integer not null,request_id uuid not null,source_capabilities text[] not null,
 changed_by uuid not null references auth.users(id),changed_at timestamptz not null default now(),
 primary key(workspace_id,revision),unique(workspace_id,request_id)
);
alter table workspace_private.executive_source_permissions enable row level security;
alter table workspace_private.executive_source_permission_versions enable row level security;
revoke all on workspace_private.executive_source_permissions,workspace_private.executive_source_permission_versions from public,anon,authenticated;

create function workspace_private.require_executive_any() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace();
begin
 if not exists(select 1 from unnest(array['executive.coordination','executive.brief','executive.review']) c
  where workspace_private.bundle_capability_active(target,'executive',c)) then raise exception 'Executive access is unavailable.' using errcode='42501'; end if;
 return target;
end; $$;
create function workspace_private.executive_source_allowed(p_target uuid,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
 select workspace_private.bundle_capability_active(p_target,'executive','executive.coordination')
 and exists(select 1 from workspace_private.executive_source_permissions s where s.workspace_id=p_target and p_capability=any(s.source_capabilities))
 and workspace_private.bundle_capability_active(p_target,workspace_private.executive_source_definition(p_capability)->>'bundleKey',p_capability);
$$;
create function workspace.executive_get_source_permissions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive('commitment'); s workspace_private.executive_source_permissions;
begin
 select * into s from workspace_private.executive_source_permissions x where x.workspace_id=target;
 return jsonb_build_object('revision',coalesce(s.revision,0),'sourceCapabilities',coalesce(to_jsonb(s.source_capabilities),'[]'),'updatedAt',s.updated_at);
end; $$;
create function workspace.executive_set_source_permissions(p_capabilities jsonb,p_expected_revision integer,p_request_id uuid,p_confirm_task_metadata_only boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive('commitment'); s workspace_private.executive_source_permissions;
 v workspace_private.executive_source_permission_versions; selected text[]; capability text;
begin
 perform workspace_private.executive_direct_user();
 if p_confirm_task_metadata_only is distinct from true or p_expected_revision is null or p_expected_revision<0 or p_request_id is null
  or p_capabilities is null or jsonb_typeof(p_capabilities)<>'array' then raise exception 'Confirm the exact metadata sources and current revision.' using errcode='22023'; end if;
 if jsonb_array_length(p_capabilities)>10 or exists(select 1 from jsonb_array_elements(p_capabilities) c where jsonb_typeof(c)<>'string')
  then raise exception 'Choose only supported task metadata sources.' using errcode='22023'; end if;
 select coalesce(array_agg(c order by c),'{}') into selected from jsonb_array_elements_text(p_capabilities) c;
 if cardinality(selected)<>(select count(distinct c) from unnest(selected) c) then raise exception 'Choose each source once.' using errcode='22023'; end if;
 foreach capability in array selected loop
  if workspace_private.executive_source_definition(capability) is null then raise exception 'Unsupported metadata source.' using errcode='22023'; end if;
  if not workspace_private.bundle_capability_active(target,workspace_private.executive_source_definition(capability)->>'bundleKey',capability)
   then raise exception 'The source capability is not currently available.' using errcode='42501'; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(target::text||':executive',0));
 select * into s from workspace_private.executive_source_permissions x where x.workspace_id=target for update;
 select * into v from workspace_private.executive_source_permission_versions x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  if v.base_revision<>p_expected_revision or v.source_capabilities<>selected or s.revision<>v.revision
   then raise exception 'This source permission request changed or was superseded.' using errcode='40001'; end if;
  return workspace.executive_get_source_permissions();
 end if;
 if coalesce(s.revision,0)<>p_expected_revision then raise exception 'Source permissions changed. Review the latest selection.' using errcode='40001'; end if;
 insert into workspace_private.executive_source_permissions(workspace_id,revision,source_capabilities)
 values(target,p_expected_revision+1,selected)
 on conflict(workspace_id) do update set revision=excluded.revision,source_capabilities=excluded.source_capabilities,updated_at=now()
 returning * into s;
 insert into workspace_private.executive_source_permission_versions(workspace_id,revision,base_revision,request_id,source_capabilities,changed_by)
 values(target,s.revision,p_expected_revision,p_request_id,selected,auth.uid());
 return workspace.executive_get_source_permissions();
end; $$;

-- This projection selects a fixed metadata allowlist directly. It never calls
-- full-content domain RPCs or selects their body, research, profile or source text.
create function workspace_private.executive_source_record(p_ref jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any(); capability text:=p_ref->>'capabilityId'; source_kind text:=p_ref->>'kind';
 document_id uuid; metadata jsonb; definition jsonb:=workspace_private.executive_source_definition(capability);
begin
 if not workspace_private.executive_reference_matches(p_ref) then return null; end if;
 begin document_id:=(p_ref->>'documentId')::uuid; exception when invalid_text_representation then return null; end;
 if workspace_private.executive_capability(source_kind)=capability then
  if not workspace_private.bundle_capability_active(target,'executive',capability) then return null; end if;
  select jsonb_build_object('title',x.data->>'title','state',x.data->>'state','reviewState',x.data->>'reviewState','revision',x.revision,
   'dueDate',coalesce(to_jsonb(coalesce(x.data->>'dueDate',x.data->>'followupDate',x.data->>'reviewDate')),'null'::jsonb),'sourceUpdatedAt',x.updated_at)
  into metadata from workspace_private.executive_documents x where x.workspace_id=target and x.kind=source_kind and x.id=document_id;
 elsif not workspace_private.executive_source_allowed(target,capability) then return null;
 elsif definition->>'bundleKey'='writer_editor' then
  select jsonb_build_object('title',x.title,'state',x.publication_state,'reviewState',null,'revision',x.revision,'dueDate',null,'sourceUpdatedAt',x.updated_at)
  into metadata from workspace_private.writing_resources x where x.workspace_id=target and x.id=document_id;
 elsif definition->>'bundleKey'='ministry' then
  select jsonb_build_object('title',x.data->>'title','state',x.data->>'status','reviewState',null,'revision',x.revision,
   'dueDate',case when source_kind='research' then x.data->'dueDate' else 'null'::jsonb end,'sourceUpdatedAt',x.updated_at)
  into metadata from workspace_private.ministry_documents x where x.workspace_id=target and x.kind=source_kind and x.id=document_id;
 elsif definition->>'bundleKey'='nonprofit_founder' then
  select jsonb_build_object('title',x.data->>'title','state',coalesce(x.data->>'status',x.data->>'stage'),'reviewState',null,'revision',x.revision,
   'dueDate',case source_kind when 'plan' then x.data->'targetDate' when 'partner' then x.data->'followupDate'
    when 'meeting' then x.data->'scheduledDate' else x.data->'reviewDate' end,'sourceUpdatedAt',x.updated_at)
  into metadata from workspace_private.nonprofit_documents x where x.workspace_id=target and x.kind=source_kind and x.id=document_id;
 elsif definition->>'bundleKey'='investor' then
  select jsonb_build_object('title',x.data->>'title','state',x.data->>'status','reviewState',null,'revision',x.revision,
   'dueDate',x.data->'reviewDate','sourceUpdatedAt',x.updated_at)
  into metadata from workspace_private.investor_documents x where x.workspace_id=target and x.kind=source_kind and x.id=document_id;
 end if;
 return metadata;
end; $$;
create function workspace_private.validate_executive_references(p_data jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare ref jsonb; metadata jsonb;
begin
 for ref in select * from jsonb_array_elements(p_data->'references') loop
  metadata:=workspace_private.executive_source_record(ref);
  if metadata is null then raise exception 'A linked source is unavailable or not shared. Remove it or restore current access before saving.' using errcode='42501'; end if;
  if (ref->>'revision')::integer>(metadata->>'revision')::integer then raise exception 'A linked source revision does not exist.' using errcode='22023'; end if;
 end loop;
end; $$;
create function workspace.executive_resolve_references(p_references jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive_any(); ref jsonb; metadata jsonb; result jsonb:='[]';
begin
 if p_references is null or jsonb_typeof(p_references)<>'array' then raise exception 'Use a bounded reference list.' using errcode='22023'; end if;
 perform workspace_private.executive_validate_node(p_references,workspace_private.executive_schema('commitment')->'properties'->'references');
 for ref in select * from jsonb_array_elements(p_references) loop
  if not workspace_private.executive_reference_matches(ref) then raise exception 'Reference kind and source do not match.' using errcode='22023'; end if;
  metadata:=workspace_private.executive_source_record(ref);
  if metadata is not null and (ref->>'revision')::integer>(metadata->>'revision')::integer then metadata:=null; end if;
  result:=result||jsonb_build_array(jsonb_build_object('reference',ref,'state',case when metadata is null then 'unavailable'
   when (metadata->>'revision')::integer<>(ref->>'revision')::integer then 'changed' else 'current' end,'metadata',metadata));
 end loop;
 return jsonb_build_object('references',result,'retrievedAt',now());
end; $$;
-- Executive source permission boundary complete.
create function workspace_private.executive_document_result(p workspace_private.executive_documents) returns jsonb
language sql immutable security definer set search_path='' as $$
 select case when p.id is null then null else jsonb_build_object('id',p.id,'kind',p.kind,'revision',p.revision,'data',p.data,'origin',p.origin,'createdAt',p.created_at,'updatedAt',p.updated_at) end;
$$;
create function workspace_private.executive_proposal_result(p workspace_private.executive_proposals) returns jsonb
language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'kind',p.kind,'documentId',p.document_id,'baseRevision',p.base_revision,'data',p.data,'reason',p.reason,
 'evidence',p.evidence,'origin',p.origin,'status',p.status,'createdAt',p.created_at,'appliedDocumentId',p.applied_document_id,'appliedRevision',p.applied_revision);
$$;
create function workspace.executive_get_document(p_kind text,p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive(p_kind); d workspace_private.executive_documents;
begin
 select * into d from workspace_private.executive_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id;
 if not found then raise exception 'Executive record unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('document',workspace_private.executive_document_result(d));
end; $$;
create function workspace.executive_search_documents(p_kind text,p_search text default '',p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive(p_kind); query tsquery;
begin
 if p_search is null or char_length(p_search)>200 or p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid coordination search.' using errcode='22023'; end if;
 query:=websearch_to_tsquery('simple',p_search);
 return (with matches as materialized (
  select x.* from workspace_private.executive_documents x where x.workspace_id=target and x.kind=p_kind and (trim(p_search)='' or x.search_vector@@query)
 ), page as (
  select jsonb_build_object('id',m.id,'kind',m.kind,'title',m.data->>'title','revision',m.revision,'state',m.data->>'state','reviewState',m.data->>'reviewState',
   'summary',left(coalesce(m.data->>'outcome',m.data->>'question',m.data->>'objective',m.data->>'focus',''),500),
   'dueDate',coalesce(to_jsonb(coalesce(m.data->>'dueDate',m.data->>'followupDate',m.data->>'reviewDate')),'null'::jsonb),
   'updatedAt',m.updated_at) item,m.updated_at,m.id from matches m order by m.updated_at desc,m.id limit p_limit offset p_offset
 ) select jsonb_build_object('total',(select count(*) from matches),'documents',coalesce((select jsonb_agg(item order by updated_at desc,id) from page),'[]')));
end; $$;
create function workspace.executive_save_document(p_kind text,p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_data jsonb,p_confirm_exact_record boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive(p_kind); d workspace_private.executive_documents; v workspace_private.executive_versions;
begin
 perform workspace_private.executive_direct_user();
 if p_confirm_exact_record is distinct from true or p_request_id is null or p_expected_revision is null
 or (p_document_id is null and p_expected_revision<>0) or (p_document_id is not null and p_expected_revision<1) then raise exception 'Confirm the exact Executive record and revision.' using errcode='22023'; end if;
 perform workspace_private.validate_executive(p_kind,p_data);
 perform workspace_private.validate_executive_references(p_data);
 perform pg_advisory_xact_lock(hashtextextended(target::text||':executive',0));
 select * into v from workspace_private.executive_versions x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  select * into d from workspace_private.executive_documents x where x.workspace_id=target and x.id=v.document_id;
  if v.kind<>p_kind or v.data<>p_data or v.base_document_id is distinct from p_document_id or v.base_revision<>p_expected_revision
  or v.origin<>'user' or d.revision<>v.revision then raise exception 'This coordination save changed or was superseded.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.executive_document_result(d));
 end if;
 if p_document_id is not null then
  select * into d from workspace_private.executive_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id for update;
  if not found then raise exception 'Executive record unavailable.' using errcode='P0002'; end if;
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception 'Executive record changed. Your work was not applied.' using errcode='40001'; end if;
 if d.id is null then
  insert into workspace_private.executive_documents(workspace_id,kind,revision,data,origin) values(target,p_kind,1,p_data,'user') returning * into d;
 else
  update workspace_private.executive_documents x set revision=x.revision+1,data=p_data,origin='user',updated_at=now() where x.id=d.id returning * into d;
 end if;
 insert into workspace_private.executive_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,p_request_id,p_document_id,p_expected_revision,auth.uid());
 return jsonb_build_object('document',workspace_private.executive_document_result(d));
end; $$;
create function workspace.executive_propose_document(p_kind text,p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_data jsonb,p_reason text,p_evidence text,p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive(p_kind);d workspace_private.executive_documents;
 p workspace_private.executive_proposals; base_data jsonb; actor text:=case when auth.jwt()->>'client_id' is null then 'user' else 'assistant' end; normalized jsonb:=p_data;
begin
 if p_scope is distinct from 'executive_coordination_only' or p_expected_revision is null or p_request_id is null
 or (p_document_id is null and p_expected_revision<>0) or (p_document_id is not null and p_expected_revision<1)
 or p_reason is null or char_length(trim(p_reason)) not between 1 and 2000 or p_evidence is null or char_length(trim(p_evidence)) not between 1 and 4000 then raise exception 'Invalid exact Executive proposal.' using errcode='22023'; end if;
 perform workspace_private.validate_executive(p_kind,p_data);
 perform workspace_private.validate_executive_references(p_data);
 perform pg_advisory_xact_lock(hashtextextended(target::text||':executive',0));
 if p_document_id is not null then
  select * into d from workspace_private.executive_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id for update;
  if not found then raise exception 'Executive record unavailable.' using errcode='P0002'; end if;
  select x.data into base_data from workspace_private.executive_versions x where x.workspace_id=target and x.document_id=d.id and x.revision=p_expected_revision;
  if not found then raise exception 'Executive base revision unavailable.' using errcode='40001'; end if;
 end if;
 -- The immutable base makes retries deterministic, even after later edits.
 if actor='assistant' then normalized:=workspace_private.normalize_executive(p_data,base_data); end if;
 select * into p from workspace_private.executive_proposals x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  if p.kind<>p_kind or p.document_id is distinct from p_document_id or p.base_revision<>p_expected_revision or p.data<>normalized or p.reason<>p_reason or p.evidence<>p_evidence or p.origin<>actor then raise exception 'Executive proposal request already used.' using errcode='40001'; end if;
  return workspace_private.executive_proposal_result(p);
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception 'Executive record changed. Read the latest revision first.' using errcode='40001'; end if;
 insert into workspace_private.executive_proposals(workspace_id,kind,document_id,base_revision,data,reason,evidence,origin,request_id)
 values(target,p_kind,p_document_id,p_expected_revision,normalized,p_reason,p_evidence,actor,p_request_id) returning * into p;
 return workspace_private.executive_proposal_result(p);
end; $$;
create function workspace.executive_list_proposals(p_kind text,p_offset integer default 0,p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive(p_kind);
begin
 perform workspace_private.executive_direct_user();
 if p_offset is null or p_offset not between 0 and 10000 or p_status is null or p_status not in ('pending','approved','rejected') then raise exception 'Invalid proposal page.' using errcode='22023'; end if;
 return (with matches as materialized (
  select x.* from workspace_private.executive_proposals x where x.workspace_id=target and x.kind=p_kind and x.status=p_status
 ), page as (select * from matches order by created_at,id limit 25 offset p_offset)
 select jsonb_build_object('total',(select count(*) from matches),'proposals',coalesce((select jsonb_agg(workspace_private.executive_proposal_result(p) order by p.created_at,p.id) from page p),'[]')));
end; $$;
create function workspace.executive_decide_proposal(p_proposal_id uuid,p_expected_revision integer,p_decision text,p_confirm_exact_record boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace(); d workspace_private.executive_documents; p workspace_private.executive_proposals;
begin
 perform workspace_private.executive_direct_user();
 if p_decision is null or p_decision not in ('approve','reject') or p_expected_revision is null or p_expected_revision<0 or (p_decision='approve' and p_confirm_exact_record is distinct from true) then raise exception 'Confirm the exact Executive proposal.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||':executive',0));
 select * into p from workspace_private.executive_proposals x where x.workspace_id=target and x.id=p_proposal_id for update;
 if not found then raise exception 'Executive proposal unavailable.' using errcode='P0002'; end if;
 perform workspace_private.require_executive(p.kind);
 if p.base_revision<>p_expected_revision then raise exception 'Proposal base revision changed.' using errcode='40001'; end if;
 if p.document_id is not null or p.applied_document_id is not null then
  select * into d from workspace_private.executive_documents x where x.workspace_id=target and x.id=coalesce(p.applied_document_id,p.document_id) and x.kind=p.kind for update;
  if not found then raise exception 'Executive record unavailable.' using errcode='P0002'; end if;
 end if;
 if p.status<>'pending' then
  if p.status<>(case when p_decision='approve' then 'approved' else 'rejected' end)
  or (p.status='approved' and d.revision<>p.applied_revision) then raise exception 'This proposal decision changed or was superseded.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.executive_document_result(d),'proposal',workspace_private.executive_proposal_result(p));
 end if;
 if p_decision='approve' then
  if coalesce(d.revision,0)<>p.base_revision then raise exception 'Executive record changed. Compare against the latest revision.' using errcode='40001'; end if;
  perform workspace_private.validate_executive(p.kind,p.data);
  perform workspace_private.validate_executive_references(p.data);
  if d.id is null then
   insert into workspace_private.executive_documents(workspace_id,kind,revision,data,origin) values(target,p.kind,1,p.data,p.origin) returning * into d;
  else
   update workspace_private.executive_documents x set data=p.data,revision=x.revision+1,origin=p.origin,updated_at=now() where x.id=d.id returning * into d;
  end if;
  insert into workspace_private.executive_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,gen_random_uuid(),p.document_id,p.base_revision,auth.uid());
 end if;
 update workspace_private.executive_proposals x set status=case when p_decision='approve' then 'approved' else 'rejected' end,
 applied_document_id=case when p_decision='approve' then d.id else null end,
 applied_revision=case when p_decision='approve' then d.revision else null end,decided_by=auth.uid(),decided_at=now() where x.id=p.id returning * into p;
 return jsonb_build_object('document',workspace_private.executive_document_result(d),'proposal',workspace_private.executive_proposal_result(p));
end; $$;
create function workspace.executive_document_history(p_kind text,p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_executive(p_kind);
begin
 perform workspace_private.executive_direct_user();
 if not exists(select 1 from workspace_private.executive_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id) then raise exception 'Executive record unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('revisions',coalesce((select jsonb_agg(item order by revision desc) from (
  select v.revision,jsonb_build_object('id',v.document_id,'kind',v.kind,'revision',v.revision,'data',v.data,'origin',v.origin,'createdAt',v.created_at,'updatedAt',v.updated_at) item
  from workspace_private.executive_versions v where v.workspace_id=target and v.document_id=p_document_id
   and (v.revision=1 or v.revision in(select x.revision from workspace_private.executive_versions x where x.workspace_id=target and x.document_id=p_document_id order by x.revision desc limit 9))
 ) versions),'[]'));
end; $$;


-- Executive canonical operations complete.

-- Deny all direct helper access, including anonymous and authenticated roles.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='workspace_private' and (p.proname like 'executive_%' or p.proname in
   ('require_executive','require_executive_any','validate_executive','validate_executive_references','normalize_executive')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end; $$;
revoke all on function workspace.executive_get_document(text,uuid),workspace.executive_search_documents(text,text,integer,integer),
 workspace.executive_save_document(text,uuid,integer,uuid,jsonb,boolean),workspace.executive_propose_document(text,uuid,integer,uuid,jsonb,text,text,text),
 workspace.executive_list_proposals(text,integer,text),workspace.executive_decide_proposal(uuid,integer,text,boolean),
 workspace.executive_document_history(text,uuid),workspace.executive_get_source_permissions(),
 workspace.executive_set_source_permissions(jsonb,integer,uuid,boolean),workspace.executive_resolve_references(jsonb)
 from public,anon,authenticated;
grant execute on function workspace.executive_get_document(text,uuid),workspace.executive_search_documents(text,text,integer,integer),
 workspace.executive_save_document(text,uuid,integer,uuid,jsonb,boolean),workspace.executive_propose_document(text,uuid,integer,uuid,jsonb,text,text,text),
 workspace.executive_list_proposals(text,integer,text),workspace.executive_decide_proposal(uuid,integer,text,boolean),
 workspace.executive_document_history(text,uuid),workspace.executive_get_source_permissions(),
 workspace.executive_set_source_permissions(jsonb,integer,uuid,boolean),workspace.executive_resolve_references(jsonb)
 to authenticated;
notify pgrst,'reload schema';
