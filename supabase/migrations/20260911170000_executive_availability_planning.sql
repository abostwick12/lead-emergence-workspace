-- P9f: optional private meeting availability snapshots. No provider execution or new public RPC.
begin;
alter function workspace_private.executive_schema(text) rename to executive_schema_v3;
create function workspace_private.executive_schema(p_kind text) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_kind='meeting' then jsonb_set(workspace_private.executive_schema_v3(p_kind),
 '{properties,availability}',$availability${"type":"object","properties":{"input":{"type":"object","properties":{"offered":{"minItems":1,"maxItems":20,"type":"array","items":{"type":"object","properties":{"start":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"end":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"}},"required":["start","end"],"additionalProperties":false}},"available":{"minItems":1,"maxItems":20,"type":"array","items":{"type":"object","properties":{"start":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"end":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"}},"required":["start","end"],"additionalProperties":false}},"busy":{"maxItems":200,"type":"array","items":{"type":"object","properties":{"start":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"end":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"}},"required":["start","end"],"additionalProperties":false}},"checkedAt":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"source":{"type":"string","minLength":1,"maxLength":240},"confirmAvailabilityChecked":{"type":"boolean","const":true},"timeZone":{"type":"string","minLength":1,"maxLength":100},"durationMinutes":{"type":"integer","minimum":5,"maximum":480},"bufferMinutes":{"type":"integer","minimum":0,"maximum":120}},"required":["offered","available","busy","checkedAt","source","confirmAvailabilityChecked","timeZone","durationMinutes","bufferMinutes"],"additionalProperties":false},"participants":{"maxItems":30,"type":"array","items":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":240},"role":{"type":"string","maxLength":240}},"required":["name","role"],"additionalProperties":false}}},"required":["input","participants"],"additionalProperties":false}$availability$::jsonb)
 else workspace_private.executive_schema_v3(p_kind) end;
$$;
alter function workspace_private.validate_executive(text,jsonb) rename to validate_executive_v3;
create function workspace_private.validate_executive(p_kind text,p_data jsonb) returns void
language plpgsql stable set search_path='' as $$
declare snapshot jsonb:=p_data->'availability'; v jsonb; start_at timestamptz; end_at timestamptz;
begin
 perform workspace_private.validate_executive_v3(p_kind,p_data);
 if p_kind='meeting' and snapshot is not null then
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=snapshot->'input'->>'timeZone')
   then raise exception 'Use a supported availability time zone.' using errcode='22023'; end if;
  for v in select * from jsonb_array_elements((snapshot->'input'->'offered')||(snapshot->'input'->'available')||(snapshot->'input'->'busy')) loop
   start_at:=(v->>'start')::timestamptz; end_at:=(v->>'end')::timestamptz;
   if not isfinite(start_at) or not isfinite(end_at) or end_at<=start_at or end_at-start_at>interval '31 days'
    then raise exception 'Use positive availability windows of at most 31 days.' using errcode='22023'; end if;
  end loop;
  -- Stale snapshots are retained as historical evidence, never silently made fresh.
  -- Selecting a new candidate requires a separate current availability check.
 end if;
end; $$;
revoke all on function workspace_private.executive_schema(text),
 workspace_private.validate_executive(text,jsonb),
 workspace_private.executive_schema_v3(text),
 workspace_private.validate_executive_v3(text,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
