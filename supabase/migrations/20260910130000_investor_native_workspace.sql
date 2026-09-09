-- Native Investor public-research records. No client assignments, brokerage accounts,
-- trade execution, hosted changes or automatic monitoring are created.
-- Generated base schemas come from bundles/investor/contracts.ts; cross-field
-- evidence and scenario rules are independently enforced below.
create function workspace_private.investor_schema(p_kind text) returns jsonb
language sql immutable set search_path='' as $$
 select case p_kind
 when 'watchlist' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"status":{"type":"string","enum":["draft","active","review_required","archived"]},"asOfDate":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"purpose":{"type":"string","maxLength":4000},"entries":{"maxItems":50,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"instrument":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":240},"ticker":{"type":"string","maxLength":30},"exchange":{"type":"string","maxLength":100},"cik":{"anyOf":[{"type":"string","const":""},{"type":"string","pattern":"^\\d{10}$"}]}},"required":["name","ticker","exchange","cik"],"additionalProperties":false},"rationale":{"type":"string","minLength":1,"maxLength":2000},"nextQuestion":{"type":"string","maxLength":2000},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"status":{"type":"string","enum":["watching","paused","archived"]}},"required":["id","instrument","rationale","nextQuestion","reviewDate","status"],"additionalProperties":false}}},"required":["title","status","asOfDate","reviewDate","purpose","entries"],"additionalProperties":false}$schema$::jsonb
 when 'thesis' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"status":{"type":"string","enum":["draft","active","review_required","archived"]},"asOfDate":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"instrument":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":240},"ticker":{"type":"string","maxLength":30},"exchange":{"type":"string","maxLength":100},"cik":{"anyOf":[{"type":"string","const":""},{"type":"string","pattern":"^\\d{10}$"}]}},"required":["name","ticker","exchange","cik"],"additionalProperties":false},"question":{"type":"string","minLength":1,"maxLength":4000},"thesis":{"type":"string","minLength":1,"maxLength":8000},"horizon":{"type":"string","minLength":1,"maxLength":200},"stance":{"type":"string","enum":["investigating","constructive","cautious","mixed","invalidated"]},"confidence":{"anyOf":[{"type":"number","minimum":0,"maximum":100},{"type":"null"}]},"changeAssessment":{"type":"string","enum":["not_reviewed","no_material_change","supported","challenged","invalidated"]},"changeReason":{"type":"string","maxLength":4000},"sources":{"maxItems":40,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":500},"publisher":{"type":"string","minLength":1,"maxLength":300},"url":{"type":"string","maxLength":2000,"format":"uri"},"type":{"type":"string","enum":["filing","earnings","company","government","market_data","secondary"]},"sourceDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"periodEnd":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"retrievedAt":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"reference":{"type":"string","maxLength":2000},"excerpt":{"type":"string","maxLength":3000},"status":{"type":"string","enum":["unverified","checked","stale","superseded"]},"limitations":{"type":"string","maxLength":2000}},"required":["id","title","publisher","url","type","sourceDate","periodEnd","retrievedAt","reference","excerpt","status","limitations"],"additionalProperties":false}},"claims":{"maxItems":60,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"kind":{"type":"string","enum":["FACT","INTERPRETATION","THESIS","SCENARIO","PREDICTION"]},"text":{"type":"string","minLength":1,"maxLength":4000},"relation":{"type":"string","enum":["supports","challenges","context"]},"sourceIds":{"maxItems":12,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"epistemicState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"confidence":{"anyOf":[{"type":"number","minimum":0,"maximum":100},{"type":"null"}]},"uncertainty":{"type":"string","maxLength":2000}},"required":["id","kind","text","relation","sourceIds","epistemicState","confidence","uncertainty"],"additionalProperties":false}},"catalysts":{"maxItems":30,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":240},"type":{"type":"string","enum":["earnings","filing","company","macro","other"]},"eventDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"dateState":{"type":"string","enum":["unknown","estimated","announced","occurred"]},"status":{"type":"string","enum":["open","reviewed","cancelled"]},"sourceIds":{"maxItems":12,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"whyItMatters":{"type":"string","minLength":1,"maxLength":2000},"nextCheck":{"type":"string","maxLength":2000}},"required":["id","title","type","eventDate","dateState","status","sourceIds","whyItMatters","nextCheck"],"additionalProperties":false}},"uncertainty":{"type":"string","minLength":1,"maxLength":4000},"nextQuestion":{"type":"string","maxLength":2000},"invalidations":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"condition":{"type":"string","minLength":1,"maxLength":2000},"status":{"type":"string","enum":["unchecked","not_triggered","triggered"]},"sourceIds":{"maxItems":12,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"assessment":{"type":"string","maxLength":2000}},"required":["id","condition","status","sourceIds","assessment"],"additionalProperties":false}},"scenarioMode":{"type":"string","enum":["draft","exclusive_complete"]},"scenarios":{"maxItems":8,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":120},"assumptions":{"type":"string","minLength":1,"maxLength":4000},"outcome":{"type":"string","minLength":1,"maxLength":2000},"probability":{"anyOf":[{"type":"number","minimum":0,"maximum":100},{"type":"null"}]},"returnPercent":{"anyOf":[{"type":"number","minimum":-100,"maximum":100000},{"type":"null"}]},"invalidatedBy":{"type":"string","minLength":1,"maxLength":2000}},"required":["id","title","assumptions","outcome","probability","returnPercent","invalidatedBy"],"additionalProperties":false}}},"required":["title","status","asOfDate","reviewDate","instrument","question","thesis","horizon","stance","confidence","changeAssessment","changeReason","sources","claims","catalysts","uncertainty","nextQuestion","invalidations","scenarioMode","scenarios"],"additionalProperties":false}$schema$::jsonb
 when 'filing' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"status":{"type":"string","enum":["draft","active","review_required","archived"]},"asOfDate":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"instrument":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":240},"ticker":{"type":"string","maxLength":30},"exchange":{"type":"string","maxLength":100},"cik":{"anyOf":[{"type":"string","const":""},{"type":"string","pattern":"^\\d{10}$"}]}},"required":["name","ticker","exchange","cik"],"additionalProperties":false},"filerName":{"type":"string","minLength":1,"maxLength":240},"filerCik":{"anyOf":[{"type":"string","const":""},{"type":"string","pattern":"^\\d{10}$"}]},"form":{"type":"string","enum":["4","10-K","10-K/A","10-Q","10-Q/A","8-K","8-K/A","4/A","SC 13D","SC 13D/A","SC 13G","SC 13G/A","SCHEDULE 13D","SCHEDULE 13D/A","SCHEDULE 13G","SCHEDULE 13G/A","13F-HR","13F-HR/A","13F-NT","13F-NT/A","other"]},"accession":{"anyOf":[{"type":"string","const":""},{"type":"string","pattern":"^\\d{10}-\\d{2}-\\d{6}$"}]},"filingUrl":{"type":"string","maxLength":2000,"format":"uri"},"filedDate":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"periodEnd":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"amendmentOf":{"type":"string","maxLength":2000},"question":{"type":"string","minLength":1,"maxLength":4000},"sources":{"maxItems":40,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":500},"publisher":{"type":"string","minLength":1,"maxLength":300},"url":{"type":"string","maxLength":2000,"format":"uri"},"type":{"type":"string","enum":["filing","earnings","company","government","market_data","secondary"]},"sourceDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"periodEnd":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"retrievedAt":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"reference":{"type":"string","maxLength":2000},"excerpt":{"type":"string","maxLength":3000},"status":{"type":"string","enum":["unverified","checked","stale","superseded"]},"limitations":{"type":"string","maxLength":2000}},"required":["id","title","publisher","url","type","sourceDate","periodEnd","retrievedAt","reference","excerpt","status","limitations"],"additionalProperties":false}},"claims":{"maxItems":60,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"kind":{"type":"string","enum":["FACT","INTERPRETATION","THESIS","SCENARIO","PREDICTION"]},"text":{"type":"string","minLength":1,"maxLength":4000},"relation":{"type":"string","enum":["supports","challenges","context"]},"sourceIds":{"maxItems":12,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"epistemicState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"confidence":{"anyOf":[{"type":"number","minimum":0,"maximum":100},{"type":"null"}]},"uncertainty":{"type":"string","maxLength":2000}},"required":["id","kind","text","relation","sourceIds","epistemicState","confidence","uncertainty"],"additionalProperties":false}},"catalysts":{"maxItems":30,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":240},"type":{"type":"string","enum":["earnings","filing","company","macro","other"]},"eventDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"dateState":{"type":"string","enum":["unknown","estimated","announced","occurred"]},"status":{"type":"string","enum":["open","reviewed","cancelled"]},"sourceIds":{"maxItems":12,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"whyItMatters":{"type":"string","minLength":1,"maxLength":2000},"nextCheck":{"type":"string","maxLength":2000}},"required":["id","title","type","eventDate","dateState","status","sourceIds","whyItMatters","nextCheck"],"additionalProperties":false}},"uncertainty":{"type":"string","minLength":1,"maxLength":4000},"nextQuestion":{"type":"string","maxLength":2000},"transactionDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"transactionCodes":{"type":"string","maxLength":200},"transactionFootnotes":{"type":"string","maxLength":8000},"plan10b51":{"type":"string","enum":["unknown","disclosed","not_disclosed"]},"holdingsLimitations":{"type":"string","maxLength":4000}},"required":["title","status","asOfDate","reviewDate","instrument","filerName","filerCik","form","accession","filingUrl","filedDate","periodEnd","amendmentOf","question","sources","claims","catalysts","uncertainty","nextQuestion","transactionDate","transactionCodes","transactionFootnotes","plan10b51","holdingsLimitations"],"additionalProperties":false}$schema$::jsonb
 when 'brief' then $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":240},"status":{"type":"string","enum":["draft","active","review_required","archived"]},"asOfDate":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"reviewDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"scope":{"type":"string","minLength":1,"maxLength":2000},"periodStart":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"periodEnd":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"summary":{"type":"string","minLength":1,"maxLength":8000},"sources":{"maxItems":40,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":500},"publisher":{"type":"string","minLength":1,"maxLength":300},"url":{"type":"string","maxLength":2000,"format":"uri"},"type":{"type":"string","enum":["filing","earnings","company","government","market_data","secondary"]},"sourceDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"periodEnd":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"retrievedAt":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"reference":{"type":"string","maxLength":2000},"excerpt":{"type":"string","maxLength":3000},"status":{"type":"string","enum":["unverified","checked","stale","superseded"]},"limitations":{"type":"string","maxLength":2000}},"required":["id","title","publisher","url","type","sourceDate","periodEnd","retrievedAt","reference","excerpt","status","limitations"],"additionalProperties":false}},"claims":{"maxItems":60,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"kind":{"type":"string","enum":["FACT","INTERPRETATION","THESIS","SCENARIO","PREDICTION"]},"text":{"type":"string","minLength":1,"maxLength":4000},"relation":{"type":"string","enum":["supports","challenges","context"]},"sourceIds":{"maxItems":12,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"epistemicState":{"type":"string","enum":["user_stated","inferred","confirmed","stale","rejected"]},"confidence":{"anyOf":[{"type":"number","minimum":0,"maximum":100},{"type":"null"}]},"uncertainty":{"type":"string","maxLength":2000}},"required":["id","kind","text","relation","sourceIds","epistemicState","confidence","uncertainty"],"additionalProperties":false}},"catalysts":{"maxItems":30,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":240},"type":{"type":"string","enum":["earnings","filing","company","macro","other"]},"eventDate":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"dateState":{"type":"string","enum":["unknown","estimated","announced","occurred"]},"status":{"type":"string","enum":["open","reviewed","cancelled"]},"sourceIds":{"maxItems":12,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"whyItMatters":{"type":"string","minLength":1,"maxLength":2000},"nextCheck":{"type":"string","maxLength":2000}},"required":["id","title","type","eventDate","dateState","status","sourceIds","whyItMatters","nextCheck"],"additionalProperties":false}},"uncertainty":{"type":"string","minLength":1,"maxLength":4000},"nextQuestion":{"type":"string","maxLength":2000}},"required":["title","status","asOfDate","reviewDate","scope","periodStart","periodEnd","summary","sources","claims","catalysts","uncertainty","nextQuestion"],"additionalProperties":false}$schema$::jsonb
 end;
$$;
insert into workspace.bundle_definitions(bundle_key,display_name,description)
values('investor','Investor','Source-aware public company, filing, watchlist and thesis research.') on conflict do nothing;
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('investor_company_research','Company and market research','Keep public-evidence watchlists and market briefs with explicit research gaps.'),
 ('investor_filings','Public filing research','Review dated SEC disclosures with amendments, transaction context and reporting-lag caveats.'),
 ('investor_thesis','Investment theses','Track supporting and challenging evidence, hypotheses, scenarios and observable invalidation.')
on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key)
select 'investor',x from unnest(array['investor_company_research','investor_filings','investor_thesis']) x on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values
 ('investor','investor_company_research','investor.company_research'),('investor','investor_filings','investor.filings'),
 ('investor','investor_thesis','investor.thesis') on conflict do nothing;

create table workspace_private.investor_documents(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 kind text not null check(kind in ('watchlist','thesis','filing','brief')),revision integer not null check(revision>0),data jsonb not null,
 origin text not null check(origin in ('user','assistant')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 search_vector tsvector generated always as (jsonb_to_tsvector('simple'::regconfig,data,'["string"]'::jsonb)) stored,unique(workspace_id,id)
);
create index investor_document_search on workspace_private.investor_documents using gin(search_vector);
create index investor_document_list on workspace_private.investor_documents(workspace_id,kind,updated_at desc,id);
create table workspace_private.investor_versions(
 workspace_id uuid not null,document_id uuid not null,revision integer not null,kind text not null,data jsonb not null,
 origin text not null,created_at timestamptz not null,updated_at timestamptz not null,
 request_id uuid not null,base_document_id uuid,base_revision integer not null,recorded_by uuid not null references auth.users(id),
 primary key(document_id,revision),unique(workspace_id,request_id),
 foreign key(workspace_id,document_id) references workspace_private.investor_documents(workspace_id,id) on delete cascade
);
create table workspace_private.investor_proposals(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 kind text not null check(kind in ('watchlist','thesis','filing','brief')),document_id uuid,base_revision integer not null check(base_revision>=0),
 data jsonb not null,reason text not null,evidence text not null,origin text not null check(origin in ('user','assistant')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),
 request_id uuid not null,applied_document_id uuid,applied_revision integer,decided_by uuid references auth.users(id),decided_at timestamptz,
 unique(workspace_id,request_id),foreign key(workspace_id,document_id) references workspace_private.investor_documents(workspace_id,id) on delete cascade,
 foreign key(workspace_id,applied_document_id) references workspace_private.investor_documents(workspace_id,id) on delete cascade,
 check((document_id is null and base_revision=0) or (document_id is not null and base_revision>0))
);
create index investor_proposal_queue on workspace_private.investor_proposals(workspace_id,kind,status,created_at,id);
alter table workspace_private.investor_documents enable row level security;
alter table workspace_private.investor_versions enable row level security;
alter table workspace_private.investor_proposals enable row level security;
revoke all on workspace_private.investor_documents,workspace_private.investor_versions,workspace_private.investor_proposals from public,anon,authenticated;

create function workspace_private.investor_capability(p_kind text) returns text
language sql immutable set search_path='' as $$
 select case p_kind when 'watchlist' then 'investor.company_research' when 'thesis' then 'investor.thesis' when 'filing' then 'investor.filings' when 'brief' then 'investor.company_research' end;
$$;
create function workspace_private.require_investor(p_kind text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace(); capability text:=workspace_private.investor_capability(p_kind);
begin
 if capability is null then raise exception 'Choose a research record type.' using errcode='22023'; end if;
 if not workspace_private.bundle_capability_active(target,'investor',capability) then raise exception 'Investor access is unavailable.' using errcode='42501'; end if;
 return target;
end; $$;
create function workspace_private.investor_direct_user() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Review and confirm this change yourself in Workspace.' using errcode='42501';
 end if;
end; $$;

-- Independently validate direct database input; never rely on model or browser validation.
create function workspace_private.investor_object(p_value jsonb,p_text_limits jsonb,p_other_keys text[]) returns void
language plpgsql immutable set search_path='' as $$
declare item record;
begin
 if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Expected an administrative object.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_value) k where not(p_text_limits ? k) and not(k=any(p_other_keys)))
 or exists(select 1 from jsonb_object_keys(p_text_limits) k where not(p_value ? k))
 or exists(select 1 from unnest(p_other_keys) k where not(p_value ? k)) then raise exception 'Invalid or missing administrative field.' using errcode='22023'; end if;
 for item in select * from jsonb_each(p_text_limits) loop
  if jsonb_typeof(p_value->item.key)<>'string' or char_length(p_value->>item.key)>(item.value::text)::integer then raise exception 'Invalid research text.' using errcode='22023'; end if;
 end loop;
end; $$;
create function workspace_private.investor_array(p_value jsonb,p_count integer,p_chars integer default null) returns void
language plpgsql immutable set search_path='' as $$
declare v jsonb;
begin
 if p_value is null or jsonb_typeof(p_value)<>'array' then raise exception 'Expected a research list.' using errcode='22023'; end if;
 if jsonb_array_length(p_value)>p_count then raise exception 'Investor list is too long.' using errcode='22023'; end if;
 if p_chars is not null then
  for v in select * from jsonb_array_elements(p_value) loop
   if jsonb_typeof(v)<>'string' or char_length(trim(v#>>'{}')) not between 1 and p_chars then raise exception 'Invalid research list entry.' using errcode='22023'; end if;
  end loop;
  if (select count(distinct lower(trim(x))) from jsonb_array_elements_text(p_value) x)<>jsonb_array_length(p_value) then raise exception 'Repeated research list entry.' using errcode='22023'; end if;
 end if;
end; $$;
create function workspace_private.investor_date(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare raw text:=p_value#>>'{}'; d date;
begin
 if p_value='null'::jsonb then return; end if;
 if jsonb_typeof(p_value) is distinct from 'string' or raw!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid research date.' using errcode='22023'; end if;
 begin d:=raw::date; exception when others then raise exception 'Invalid research date.' using errcode='22023'; end;
 if to_char(d,'YYYY-MM-DD')<>raw then raise exception 'Invalid research date.' using errcode='22023'; end if;
end; $$;
create function workspace_private.investor_uuid(p_value jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p_value) is distinct from 'string' or (p_value#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid research identifier.' using errcode='22023'; end if;
end; $$;
-- This bounded evaluator implements only the generated base-schema keywords.
-- It never accepts a schema supplied by a caller or fetches a referenced URL.
create function workspace_private.investor_validate_node(p_value jsonb,p_schema jsonb,p_depth integer default 0) returns void
language plpgsql immutable set search_path='' as $$
declare child jsonb; entry record; valid boolean:=false; raw text:=p_value#>>'{}'; n numeric; width integer; port_value text;
begin
 if p_depth>14 or p_value is null or p_schema is null then raise exception 'Invalid research structure.' using errcode='22023'; end if;
 if p_schema ? 'anyOf' then
  for child in select * from jsonb_array_elements(p_schema->'anyOf') loop
   begin perform workspace_private.investor_validate_node(p_value,child,p_depth+1); valid:=true; exit;
   exception when sqlstate '22023' then null; end;
  end loop;
  if not valid then raise exception 'Invalid research value.' using errcode='22023'; end if;
  return;
 end if;
 if jsonb_typeof(p_value) is distinct from p_schema->>'type' then raise exception 'Invalid research field type.' using errcode='22023'; end if;
 if p_schema ? 'const' and p_value<>p_schema->'const' then raise exception 'Invalid research constant.' using errcode='22023'; end if;
 if p_schema ? 'enum' and not exists(select 1 from jsonb_array_elements(p_schema->'enum') e where e=p_value) then raise exception 'Invalid research option.' using errcode='22023'; end if;
 if p_schema->>'type'='object' then
  if exists(select 1 from jsonb_object_keys(p_value) k where not(p_schema->'properties' ? k))
   or exists(select 1 from jsonb_array_elements_text(p_schema->'required') k where not(p_value ? k)) then raise exception 'Unknown or missing research field.' using errcode='22023'; end if;
  for entry in select * from jsonb_each(p_value) loop perform workspace_private.investor_validate_node(entry.value,p_schema->'properties'->entry.key,p_depth+1); end loop;
 elsif p_schema->>'type'='array' then
  if jsonb_array_length(p_value)>coalesce((p_schema->>'maxItems')::integer,100) then raise exception 'Research list is too long.' using errcode='22023'; end if;
  for child in select * from jsonb_array_elements(p_value) loop perform workspace_private.investor_validate_node(child,p_schema->'items',p_depth+1); end loop;
 elsif p_schema->>'type'='string' then
  -- Match JavaScript string limits, counting a non-BMP character as two code units.
  width:=char_length(raw)+char_length(regexp_replace(raw,U&'[\0001-\FFFF]','','g'));
  if width>coalesce((p_schema->>'maxLength')::integer,100000)
   or (p_schema ? 'minLength' and (char_length(btrim(raw))<(p_schema->>'minLength')::integer)) then raise exception 'Research text is empty or too long.' using errcode='22023'; end if;
  if p_schema ? 'pattern' and raw !~ (p_schema->>'pattern') then raise exception 'Invalid research text format.' using errcode='22023'; end if;
  if p_schema->>'format'='date' then perform workspace_private.investor_date(p_value);
  elsif p_schema->>'format'='date-time' then
   begin perform raw::timestamptz; exception when others then raise exception 'Invalid research retrieval timestamp.' using errcode='22023'; end;
  elsif p_schema->>'format'='uri' then
   if raw !~ '^https?://([A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    then raise exception 'Use an HTTP(S) research source without credentials.' using errcode='22023'; end if;
   port_value:=substring(raw from '^https?://[^/?#]*:([0-9]+)(?:[/?#]|$)');
   if port_value is not null and port_value::integer>65535 then raise exception 'Invalid source port.' using errcode='22023'; end if;
  end if;
 elsif p_schema->>'type'='number' then
  n:=raw::numeric;
  if (p_schema ? 'minimum' and n<(p_schema->>'minimum')::numeric) or (p_schema ? 'maximum' and n>(p_schema->>'maximum')::numeric) then raise exception 'Research number is outside its bounds.' using errcode='22023'; end if;
 end if;
end; $$;

-- P8 cross-field validation follows.
create function workspace_private.validate_investor(p_kind text,p_data jsonb) returns void
language plpgsql stable set search_path='' as $$
declare collection text; v jsonb; ref text; key_value text; identity_keys text[]:='{}'; source_keys text[]:='{}'; total numeric;
begin
 if p_data is null or octet_length(p_data::text)>600000 then raise exception 'Research record is empty or too large.' using errcode='22023'; end if;
 perform workspace_private.investor_validate_node(p_data,workspace_private.investor_schema(p_kind));
 foreach collection in array array['entries','sources','claims','catalysts','invalidations','scenarios'] loop
  if p_data ? collection and
   (select count(distinct x->>'id') from jsonb_array_elements(p_data->collection) x)<>jsonb_array_length(p_data->collection)
   then raise exception 'Repeated research entry identifier.' using errcode='22023'; end if;
 end loop;
 if p_kind='watchlist' then
  for v in select * from jsonb_array_elements(p_data->'entries') loop
   if v->'instrument'->>'cik'='0000000000' then raise exception 'Use a positive CIK.' using errcode='22023'; end if;
   key_value:=coalesce(nullif(v->'instrument'->>'cik',''),lower((v->'instrument'->>'ticker')||'|'||(v->'instrument'->>'exchange')||'|'||btrim(v->'instrument'->>'name')));
   if key_value=any(identity_keys) then raise exception 'Instrument already on this watchlist.' using errcode='22023'; end if;
   identity_keys:=array_append(identity_keys,key_value);
  end loop;
 else
  if p_data->'instrument'->>'cik'='0000000000' or p_data->>'filerCik'='0000000000' then raise exception 'Use a positive CIK.' using errcode='22023'; end if;
  select coalesce(array_agg(s->>'id'),'{}') into source_keys from jsonb_array_elements(p_data->'sources') s;
  foreach collection in array array['claims','catalysts','invalidations'] loop
   for v in select * from jsonb_array_elements(coalesce(p_data->collection,'[]')) loop
    if (select count(distinct x) from jsonb_array_elements_text(v->'sourceIds') x)<>jsonb_array_length(v->'sourceIds')
     then raise exception 'Repeated research citation.' using errcode='22023'; end if;
    for ref in select * from jsonb_array_elements_text(v->'sourceIds') loop
     if not(ref=any(source_keys)) then raise exception 'Citation is outside this research record.' using errcode='22023'; end if;
    end loop;
    if (collection='claims' and v->>'kind'='FACT' and jsonb_array_length(v->'sourceIds')=0)
     or (collection='catalysts' and v->>'dateState' in ('announced','occurred') and jsonb_array_length(v->'sourceIds')=0)
     or (collection='invalidations' and v->>'status'<>'unchecked' and jsonb_array_length(v->'sourceIds')=0)
     then raise exception 'This research assessment needs recorded evidence.' using errcode='22023'; end if;
    if collection='catalysts' and v->>'dateState'<>'unknown' and v->>'eventDate' is null
     then raise exception 'A dated catalyst needs its date.' using errcode='22023'; end if;
   end loop;
  end loop;
 end if;
 if p_kind='thesis' then
  select coalesce(sum((s->>'probability')::numeric),0) into total from jsonb_array_elements(p_data->'scenarios') s;
  if total>100.000001 or (p_data->>'scenarioMode'='exclusive_complete' and
   (jsonb_array_length(p_data->'scenarios')<2 or abs(total-100)>.000001
    or exists(select 1 from jsonb_array_elements(p_data->'scenarios') s where s->>'probability' is null)))
   then raise exception 'Complete exclusive scenarios need probabilities totaling 100 percent.' using errcode='22023'; end if;
  if p_data->>'changeAssessment'<>'not_reviewed' and
   (btrim(p_data->>'changeReason')='' or jsonb_array_length(p_data->'sources')=0 or jsonb_array_length(p_data->'claims')=0)
   then raise exception 'Change and no-change conclusions need reasons and evidence.' using errcode='22023'; end if;
 elsif p_kind='filing' then
  if (p_data->>'periodEnd')::date>(p_data->>'filedDate')::date
   or (left(p_data->>'form',3)='13F' and (p_data->>'periodEnd' is null or btrim(p_data->>'holdingsLimitations')=''))
   then raise exception 'Record the filing period and 13F lag/holdings limitations.' using errcode='22023'; end if;
 elsif p_kind='brief' and (p_data->>'periodStart')::date>(p_data->>'periodEnd')::date
  then raise exception 'Invalid research brief period.' using errcode='22023';
 end if;
end; $$;
create function workspace_private.normalize_investor(p_data jsonb,p_base jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare normalized jsonb:=p_data; sources jsonb:='[]'; claims jsonb:='[]'; v jsonb; previous jsonb; same_refs boolean;
begin
 if p_data is not distinct from p_base then return p_data; end if;
 normalized:=jsonb_set(normalized,'{status}','"review_required"');
 if p_data ? 'sources' then
  for v in select * from jsonb_array_elements(p_data->'sources') loop
   select s into previous from jsonb_array_elements(coalesce(p_base->'sources','[]')) s where s->>'id'=v->>'id';
   sources:=sources||jsonb_build_array(case when previous is not distinct from v then v else jsonb_set(v,'{status}','"unverified"') end);
  end loop;
  for v in select * from jsonb_array_elements(p_data->'claims') loop
   select c into previous from jsonb_array_elements(coalesce(p_base->'claims','[]')) c where c->>'id'=v->>'id';
   same_refs:=not exists(select 1 from jsonb_array_elements_text(v->'sourceIds') ref where
    (select s from jsonb_array_elements(coalesce(p_base->'sources','[]')) s where s->>'id'=ref)
     is distinct from (select s from jsonb_array_elements(p_data->'sources') s where s->>'id'=ref));
   claims:=claims||jsonb_build_array(case when previous is not distinct from v and same_refs then v else jsonb_set(v,'{epistemicState}','"inferred"') end);
  end loop;
  normalized:=jsonb_set(jsonb_set(normalized,'{sources}',sources),'{claims}',claims);
 end if;
 return normalized;
end; $$;

-- P8 canonical operations follow.
create function workspace_private.investor_document_result(p workspace_private.investor_documents) returns jsonb
language sql immutable security definer set search_path='' as $$
 select case when p.id is null then null else jsonb_build_object('id',p.id,'kind',p.kind,'revision',p.revision,'data',p.data,'origin',p.origin,'createdAt',p.created_at,'updatedAt',p.updated_at) end;
$$;
create function workspace_private.investor_proposal_result(p workspace_private.investor_proposals) returns jsonb
language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'kind',p.kind,'documentId',p.document_id,'baseRevision',p.base_revision,'data',p.data,'reason',p.reason,
 'evidence',p.evidence,'origin',p.origin,'status',p.status,'createdAt',p.created_at,'appliedDocumentId',p.applied_document_id,'appliedRevision',p.applied_revision);
$$;
create function workspace.investor_get_document(p_kind text,p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_investor(p_kind); d workspace_private.investor_documents;
begin
 select * into d from workspace_private.investor_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id;
 if not found then raise exception 'Investor record unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('document',workspace_private.investor_document_result(d));
end; $$;
create function workspace.investor_search_documents(p_kind text,p_search text default '',p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_investor(p_kind); query tsquery;
begin
 if p_search is null or char_length(p_search)>200 or p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid research search.' using errcode='22023'; end if;
 query:=websearch_to_tsquery('simple',p_search);
 return (with matches as materialized (
  select x.* from workspace_private.investor_documents x where x.workspace_id=target and x.kind=p_kind and (trim(p_search)='' or x.search_vector@@query)
 ), page as (
  select jsonb_build_object('id',m.id,'kind',m.kind,'title',m.data->>'title','revision',m.revision,'status',m.data->>'status',
   'summary',left(coalesce(m.data->>'purpose',m.data->>'question',m.data->>'scope',''),500),
   'dueDate',coalesce(m.data->'reviewDate','null'::jsonb),
   'updatedAt',m.updated_at) item,m.updated_at,m.id from matches m order by m.updated_at desc,m.id limit p_limit offset p_offset
 ) select jsonb_build_object('total',(select count(*) from matches),'documents',coalesce((select jsonb_agg(item order by updated_at desc,id) from page),'[]')));
end; $$;
create function workspace.investor_save_document(p_kind text,p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_data jsonb,p_confirm_research_only boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_investor(p_kind); d workspace_private.investor_documents; v workspace_private.investor_versions;
begin
 perform workspace_private.investor_direct_user();
 if p_confirm_research_only is distinct from true or p_request_id is null or p_expected_revision is null
 or (p_document_id is null and p_expected_revision<>0) or (p_document_id is not null and p_expected_revision<1) then raise exception 'Confirm the exact public-research-only record and revision.' using errcode='22023'; end if;
 perform workspace_private.validate_investor(p_kind,p_data);
 perform pg_advisory_xact_lock(hashtextextended(target::text||':investor',0));
 select * into v from workspace_private.investor_versions x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  select * into d from workspace_private.investor_documents x where x.workspace_id=target and x.id=v.document_id;
  if v.kind<>p_kind or v.data<>p_data or v.base_document_id is distinct from p_document_id or v.base_revision<>p_expected_revision
  or v.origin<>'user' or d.revision<>v.revision then raise exception 'This research save changed or was superseded.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.investor_document_result(d));
 end if;
 if p_document_id is not null then
  select * into d from workspace_private.investor_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id for update;
  if not found then raise exception 'Investor record unavailable.' using errcode='P0002'; end if;
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception 'Investor record changed. Your work was not applied.' using errcode='40001'; end if;
 if d.id is null then
  insert into workspace_private.investor_documents(workspace_id,kind,revision,data,origin) values(target,p_kind,1,p_data,'user') returning * into d;
 else
  update workspace_private.investor_documents x set revision=x.revision+1,data=p_data,origin='user',updated_at=now() where x.id=d.id returning * into d;
 end if;
 insert into workspace_private.investor_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,p_request_id,p_document_id,p_expected_revision,auth.uid());
 return jsonb_build_object('document',workspace_private.investor_document_result(d));
end; $$;
create function workspace.investor_propose_document(p_kind text,p_document_id uuid,p_expected_revision integer,p_request_id uuid,p_data jsonb,p_reason text,p_evidence text,p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_investor(p_kind);d workspace_private.investor_documents;
 p workspace_private.investor_proposals; base_data jsonb; actor text:=case when auth.jwt()->>'client_id' is null then 'user' else 'assistant' end; normalized jsonb:=p_data;
begin
 if p_scope is distinct from 'public_research_only' or p_expected_revision is null or p_request_id is null
 or (p_document_id is null and p_expected_revision<>0) or (p_document_id is not null and p_expected_revision<1)
 or p_reason is null or char_length(trim(p_reason)) not between 1 and 2000 or p_evidence is null or char_length(trim(p_evidence)) not between 1 and 4000 then raise exception 'Invalid public-research-only proposal.' using errcode='22023'; end if;
 perform workspace_private.validate_investor(p_kind,p_data);
 perform pg_advisory_xact_lock(hashtextextended(target::text||':investor',0));
 if p_document_id is not null then
  select * into d from workspace_private.investor_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id for update;
  if not found then raise exception 'Investor record unavailable.' using errcode='P0002'; end if;
  select x.data into base_data from workspace_private.investor_versions x where x.workspace_id=target and x.document_id=d.id and x.revision=p_expected_revision;
  if not found then raise exception 'Investor base revision unavailable.' using errcode='40001'; end if;
 end if;
 -- The immutable base makes retries deterministic, even after later edits.
 if actor='assistant' then normalized:=workspace_private.normalize_investor(p_data,base_data); end if;
 select * into p from workspace_private.investor_proposals x where x.workspace_id=target and x.request_id=p_request_id;
 if found then
  if p.kind<>p_kind or p.document_id is distinct from p_document_id or p.base_revision<>p_expected_revision or p.data<>normalized or p.reason<>p_reason or p.evidence<>p_evidence or p.origin<>actor then raise exception 'Investor proposal request already used.' using errcode='40001'; end if;
  return workspace_private.investor_proposal_result(p);
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception 'Investor record changed. Read the latest revision first.' using errcode='40001'; end if;
 insert into workspace_private.investor_proposals(workspace_id,kind,document_id,base_revision,data,reason,evidence,origin,request_id)
 values(target,p_kind,p_document_id,p_expected_revision,normalized,p_reason,p_evidence,actor,p_request_id) returning * into p;
 return workspace_private.investor_proposal_result(p);
end; $$;
create function workspace.investor_list_proposals(p_kind text,p_offset integer default 0,p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_investor(p_kind);
begin
 perform workspace_private.investor_direct_user();
 if p_offset is null or p_offset not between 0 and 10000 or p_status is null or p_status not in ('pending','approved','rejected') then raise exception 'Invalid proposal page.' using errcode='22023'; end if;
 return (with matches as materialized (
  select x.* from workspace_private.investor_proposals x where x.workspace_id=target and x.kind=p_kind and x.status=p_status
 ), page as (select * from matches order by created_at,id limit 25 offset p_offset)
 select jsonb_build_object('total',(select count(*) from matches),'proposals',coalesce((select jsonb_agg(workspace_private.investor_proposal_result(p) order by p.created_at,p.id) from page p),'[]')));
end; $$;
create function workspace.investor_decide_proposal(p_proposal_id uuid,p_expected_revision integer,p_decision text,p_confirm_research_only boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace(); d workspace_private.investor_documents; p workspace_private.investor_proposals;
begin
 perform workspace_private.investor_direct_user();
 if p_decision is null or p_decision not in ('approve','reject') or p_expected_revision is null or p_expected_revision<0 or (p_decision='approve' and p_confirm_research_only is distinct from true) then raise exception 'Confirm the exact public-research-only proposal.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text||':investor',0));
 select * into p from workspace_private.investor_proposals x where x.workspace_id=target and x.id=p_proposal_id for update;
 if not found then raise exception 'Investor proposal unavailable.' using errcode='P0002'; end if;
 perform workspace_private.require_investor(p.kind);
 if p.base_revision<>p_expected_revision then raise exception 'Proposal base revision changed.' using errcode='40001'; end if;
 if p.document_id is not null or p.applied_document_id is not null then
  select * into d from workspace_private.investor_documents x where x.workspace_id=target and x.id=coalesce(p.applied_document_id,p.document_id) and x.kind=p.kind for update;
  if not found then raise exception 'Investor record unavailable.' using errcode='P0002'; end if;
 end if;
 if p.status<>'pending' then
  if p.status<>(case when p_decision='approve' then 'approved' else 'rejected' end)
  or (p.status='approved' and d.revision<>p.applied_revision) then raise exception 'This proposal decision changed or was superseded.' using errcode='40001'; end if;
  return jsonb_build_object('document',workspace_private.investor_document_result(d),'proposal',workspace_private.investor_proposal_result(p));
 end if;
 if p_decision='approve' then
  if coalesce(d.revision,0)<>p.base_revision then raise exception 'Investor record changed. Compare against the latest revision.' using errcode='40001'; end if;
  perform workspace_private.validate_investor(p.kind,p.data);
  if d.id is null then
   insert into workspace_private.investor_documents(workspace_id,kind,revision,data,origin) values(target,p.kind,1,p.data,p.origin) returning * into d;
  else
   update workspace_private.investor_documents x set data=p.data,revision=x.revision+1,origin=p.origin,updated_at=now() where x.id=d.id returning * into d;
  end if;
  insert into workspace_private.investor_versions values(target,d.id,d.revision,d.kind,d.data,d.origin,d.created_at,d.updated_at,gen_random_uuid(),p.document_id,p.base_revision,auth.uid());
 end if;
 update workspace_private.investor_proposals x set status=case when p_decision='approve' then 'approved' else 'rejected' end,
 applied_document_id=case when p_decision='approve' then d.id else null end,
 applied_revision=case when p_decision='approve' then d.revision else null end,decided_by=auth.uid(),decided_at=now() where x.id=p.id returning * into p;
 return jsonb_build_object('document',workspace_private.investor_document_result(d),'proposal',workspace_private.investor_proposal_result(p));
end; $$;
create function workspace.investor_document_history(p_kind text,p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_investor(p_kind);
begin
 perform workspace_private.investor_direct_user();
 if not exists(select 1 from workspace_private.investor_documents x where x.workspace_id=target and x.kind=p_kind and x.id=p_document_id) then raise exception 'Investor record unavailable.' using errcode='P0002'; end if;
 return jsonb_build_object('revisions',coalesce((select jsonb_agg(item order by revision desc) from (
  select v.revision,jsonb_build_object('id',v.document_id,'kind',v.kind,'revision',v.revision,'data',v.data,'origin',v.origin,'createdAt',v.created_at,'updatedAt',v.updated_at) item
  from workspace_private.investor_versions v where v.workspace_id=target and v.document_id=p_document_id
   and (v.revision=1 or v.revision in(select x.revision from workspace_private.investor_versions x where x.workspace_id=target and x.document_id=p_document_id order by x.revision desc limit 9))
 ) versions),'[]'));
end; $$;

create function workspace.investor_next_moves() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_bundle_workspace();
begin
 if not exists(select 1 from unnest(array['watchlist','thesis','filing','brief']) k
  where workspace_private.bundle_capability_active(target,'investor',workspace_private.investor_capability(k)))
  then raise exception 'Investor access is unavailable.' using errcode='42501'; end if;
 return (with admitted as materialized (
  select x.* from workspace_private.investor_documents x where x.workspace_id=target
   and x.data->>'status'<>'archived'
   and workspace_private.bundle_capability_active(target,'investor',workspace_private.investor_capability(x.kind))
 ), items as (
  select d.id::text item_id,d.id document_id,d.kind,d.revision,d.data->>'title' title,(d.data->>'reviewDate')::date due_date,
   case when d.data->>'stance'='invalidated' or exists(select 1 from jsonb_array_elements(coalesce(d.data->'invalidations','[]')) i where i->>'status'='triggered')
     then 'Your saved thesis review flags invalidation; inspect its evidence before acting.'
    when d.data->>'changeAssessment'='challenged' then 'Your saved review identifies a challenge to this thesis.'
    when d.data->>'status'='review_required' then 'This saved research needs source and inference review.'
    when jsonb_array_length(d.data->'sources')=0 then 'This research has no recorded public sources.'
    when (d.data->>'reviewDate')::date<current_date then 'The recorded review date has passed.'
    when not exists(select 1 from jsonb_array_elements(d.data->'claims') c where c->>'relation'='challenges') then 'No challenging evidence is recorded; that is a research gap.'
    when exists(select 1 from jsonb_array_elements(d.data->'sources') s where s->>'status'<>'checked' or (s->>'retrievedAt')::timestamptz<now()-interval '30 days')
     then 'Some source evidence is unverified, stale, superseded or was retrieved over 30 days ago.'
    else 'A planned research review is approaching.' end reason,
   'Saved '||d.kind||' revision '||d.revision||', as of '||(d.data->>'asOfDate')||'. This is not a live market scan.' evidence,
   case when d.data->>'stance'='invalidated' or d.data->>'changeAssessment'='challenged'
    or exists(select 1 from jsonb_array_elements(coalesce(d.data->'invalidations','[]')) i where i->>'status'='triggered')
    or (d.data->>'reviewDate')::date<current_date then 0 else 1 end rank
  from admitted d where d.kind<>'watchlist' and
   (d.data->>'status'='review_required' or jsonb_array_length(d.data->'sources')=0 or (d.data->>'reviewDate')::date<=current_date+7
    or d.data->>'stance'='invalidated' or d.data->>'changeAssessment'='challenged'
    or not exists(select 1 from jsonb_array_elements(d.data->'claims') c where c->>'relation'='challenges')
    or exists(select 1 from jsonb_array_elements(d.data->'sources') s where s->>'status'<>'checked' or (s->>'retrievedAt')::timestamptz<now()-interval '30 days')
    or exists(select 1 from jsonb_array_elements(coalesce(d.data->'invalidations','[]')) i where i->>'status'='triggered'))
  union all
  select d.id::text||':'||(e->>'id'),d.id,d.kind,d.revision,e->'instrument'->>'name',(e->>'reviewDate')::date,
   case when e->>'reviewDate' is null then 'This watched instrument needs a review date.' else 'A watchlist research review is due soon or overdue.' end,
   'Saved watchlist revision '||d.revision||'. '||left(e->>'nextQuestion',800),
   case when (e->>'reviewDate')::date<current_date then 0 else 1 end
  from admitted d cross join lateral jsonb_array_elements(coalesce(d.data->'entries','[]')) e
  where d.kind='watchlist' and e->>'status'='watching' and (e->>'reviewDate' is null or (e->>'reviewDate')::date<=current_date+7)
  union all
  select d.id::text||':'||(c->>'id'),d.id,d.kind,d.revision,c->>'title',(c->>'eventDate')::date,
   case when (c->>'eventDate')::date<current_date then 'A recorded catalyst date passed; check the actual outcome.'
    when c->>'eventDate' is null then 'A recorded catalyst has no date yet.'
    else 'A recorded catalyst is approaching; verify its timing and evidence.' end,
   'Saved catalyst, revision '||d.revision||'. Date status: '||(c->>'dateState')||'. '||left(c->>'whyItMatters',800),
   case when (c->>'eventDate')::date<current_date then 0 else 1 end
  from admitted d cross join lateral jsonb_array_elements(coalesce(d.data->'catalysts','[]')) c
  where c->>'status'='open' and (c->>'eventDate' is null or (c->>'eventDate')::date<=current_date+7)
 ), page as(select * from items order by rank,due_date nulls last,item_id limit 30)
 select jsonb_build_object('asOfDate',current_date,'total',(select count(*) from items),'items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',p.item_id,'documentId',p.document_id,'kind',p.kind,'title',p.title,'dueDate',p.due_date,'revision',p.revision,
  'reason',p.reason,'evidence',p.evidence,'priority',case when p.rank=0 then 'high' else 'normal' end)
  order by p.rank,p.due_date nulls last,p.item_id) from page p),'[]')));
end; $$;

-- P8 public-source access gates and final privileges follow.
create table workspace_private.investor_source_clock(
 singleton boolean primary key default true check(singleton),last_request_at timestamptz not null default '-infinity'
);
insert into workspace_private.investor_source_clock(singleton) values(true);
create table workspace_private.investor_source_budgets(
 workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
 window_started timestamptz not null,request_count integer not null check(request_count between 0 and 10)
);
alter table workspace_private.investor_source_clock enable row level security;
alter table workspace_private.investor_source_budgets enable row level security;
revoke all on workspace_private.investor_source_clock,workspace_private.investor_source_budgets from public,anon,authenticated;

-- A read-only public fetch still needs current entitlement and shared rate control.
-- No CIK, private thesis or account data is stored in this bookkeeping.
create function workspace.investor_public_source_access(p_reserve boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_investor('filing'); instant timestamptz:=clock_timestamp();
 last_request timestamptz; budget workspace_private.investor_source_budgets;
begin
 if p_reserve is null then raise exception 'Invalid source access request.' using errcode='22023'; end if;
 if not p_reserve then return jsonb_build_object('allowed',true); end if;
 perform pg_advisory_xact_lock(hashtextextended('investor-public-sec-rate',0));
 select last_request_at into last_request from workspace_private.investor_source_clock where singleton=true for update;
 if last_request>instant-interval '250 milliseconds' then raise exception 'Public-source lookup is busy. Please retry shortly.' using errcode='54000'; end if;
 select * into budget from workspace_private.investor_source_budgets b where b.workspace_id=target for update;
 if found and budget.window_started>instant-interval '1 minute' and budget.request_count>=10
  then raise exception 'Public-source lookup limit reached. Please wait one minute.' using errcode='54000'; end if;
 insert into workspace_private.investor_source_budgets(workspace_id,window_started,request_count) values(target,instant,1)
 on conflict(workspace_id) do update set
  request_count=case when investor_source_budgets.window_started>instant-interval '1 minute' then investor_source_budgets.request_count+1 else 1 end,
  window_started=case when investor_source_budgets.window_started>instant-interval '1 minute' then investor_source_budgets.window_started else instant end;
 update workspace_private.investor_source_clock set last_request_at=instant where singleton=true;
 return jsonb_build_object('allowed',true);
end; $$;

revoke all on function workspace_private.investor_schema(text),workspace_private.investor_capability(text),
 workspace_private.require_investor(text),workspace_private.investor_direct_user(),
 workspace_private.investor_object(jsonb,jsonb,text[]),workspace_private.investor_array(jsonb,integer,integer),
 workspace_private.investor_date(jsonb),workspace_private.investor_uuid(jsonb),
 workspace_private.investor_validate_node(jsonb,jsonb,integer),workspace_private.validate_investor(text,jsonb),
 workspace_private.normalize_investor(jsonb,jsonb),
 workspace_private.investor_document_result(workspace_private.investor_documents),
 workspace_private.investor_proposal_result(workspace_private.investor_proposals)
 from public,anon,authenticated;
revoke all on function workspace.investor_get_document(text,uuid),workspace.investor_search_documents(text,text,integer,integer),
 workspace.investor_save_document(text,uuid,integer,uuid,jsonb,boolean),workspace.investor_propose_document(text,uuid,integer,uuid,jsonb,text,text,text),
 workspace.investor_list_proposals(text,integer,text),workspace.investor_decide_proposal(uuid,integer,text,boolean),
 workspace.investor_document_history(text,uuid),workspace.investor_next_moves(),workspace.investor_public_source_access(boolean)
 from public,anon,authenticated;
grant execute on function workspace.investor_get_document(text,uuid),workspace.investor_search_documents(text,text,integer,integer),
 workspace.investor_save_document(text,uuid,integer,uuid,jsonb,boolean),workspace.investor_propose_document(text,uuid,integer,uuid,jsonb,text,text,text),
 workspace.investor_list_proposals(text,integer,text),workspace.investor_decide_proposal(uuid,integer,text,boolean),
 workspace.investor_document_history(text,uuid),workspace.investor_next_moves(),workspace.investor_public_source_access(boolean)
 to authenticated;
notify pgrst,'reload schema';
