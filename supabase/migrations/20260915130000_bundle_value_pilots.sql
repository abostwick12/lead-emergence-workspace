-- P16: private, metadata-only first-value pilots. These records contain no
-- client work, prompts, source excerpts, output prose, contact data or provider data.
create table workspace_private.bundle_value_pilot_definitions (
  bundle_key text primary key references workspace.bundle_definitions(bundle_key) on delete cascade,
  manifest_version text not null check (manifest_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  target_minutes smallint not null check (target_minutes between 1 and 60),
  runtime_capability_ids text[] not null check (cardinality(runtime_capability_ids) between 1 and 5),
  success_signal_ids text[] not null check (cardinality(success_signal_ids) between 1 and 10),
  evidence_required boolean not null,
  provenance_required boolean not null,
  mutation_confirmation_required boolean not null
);
alter table workspace_private.bundle_value_pilot_definitions enable row level security;
revoke all on workspace_private.bundle_value_pilot_definitions from public,anon,authenticated;

insert into workspace_private.bundle_value_pilot_definitions values
('executive','0.5.0',8,array['executive.brief','executive.coordination','executive.review'],array['executive.signal.brief_accepted','executive.signal.followup_recovered'],true,true,true),
('writer_editor','0.3.0',10,array['writer.resource.review','writer.resource.library'],array['writer.signal.review_completed','writer.signal.proposal_accepted'],true,true,true),
('ministry','0.2.0',12,array['ministry.research','ministry.teaching'],array['ministry.signal.research_brief_used','ministry.signal.prior_work_recovered'],true,true,true),
('nonprofit_founder','0.2.0',12,array['nonprofit.roadmap'],array['nonprofit.signal.roadmap_adopted','nonprofit.signal.followup_advanced'],true,true,true),
('investor','0.2.0',12,array['investor.thesis','investor.company_research','investor.filings'],array['investor.signal.thesis_updated','investor.signal.challenge_found'],true,true,true),
('workspace_experience','0.4.0',5,array['workspace.compose'],array['workspace.signal.attention_actioned','workspace.signal.layout_confirmed'],true,true,true);

create table workspace_private.bundle_value_pilot_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  bundle_key text not null references workspace_private.bundle_value_pilot_definitions(bundle_key) on delete restrict,
  status text not null check (status in ('active','completed','abandoned')),
  version integer not null check (version > 0),
  manifest_version text not null,
  target_minutes smallint not null check (target_minutes between 1 and 60),
  baseline_minutes smallint not null check (baseline_minutes between 1 and 480),
  available_signal_ids text[] not null check (cardinality(available_signal_ids) between 1 and 10),
  evidence_required boolean not null,
  provenance_required boolean not null,
  mutation_confirmation_required boolean not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  outcome_achieved boolean,
  success_signal_ids text[],
  usefulness_rating smallint check (usefulness_rating between 1 and 5),
  trust_rating smallint check (trust_rating between 1 and 5),
  actionability_rating smallint check (actionability_rating between 1 and 5),
  evidence_visible boolean,
  provenance_visible boolean,
  mutation_control_preserved boolean,
  correction_count smallint check (correction_count between 0 and 100),
  elapsed_seconds integer check (elapsed_seconds between 0 and 604800),
  target_met boolean,
  quality_gates_met boolean,
  estimated_minutes_saved smallint check (estimated_minutes_saved between 0 and 480),
  assessment text check (assessment in ('strong_signal','promising_signal','needs_iteration')),
  abandon_reason text check (abandon_reason in ('interrupted','outcome_unclear','source_gap','workflow_friction','other')),
  receipt jsonb not null,
  unique(workspace_id,user_id,id),
  check (completed_at is null or completed_at >= started_at),
  check (abandoned_at is null or abandoned_at >= started_at),
  check (
    (status='active' and completed_at is null and abandoned_at is null and outcome_achieved is null
      and success_signal_ids is null and usefulness_rating is null and trust_rating is null and actionability_rating is null
      and evidence_visible is null and provenance_visible is null and mutation_control_preserved is null
      and correction_count is null and elapsed_seconds is null and target_met is null and quality_gates_met is null
      and estimated_minutes_saved is null and assessment is null and abandon_reason is null)
    or
    (status='completed' and completed_at is not null and abandoned_at is null and outcome_achieved is not null
      and success_signal_ids is not null and usefulness_rating is not null and trust_rating is not null and actionability_rating is not null
      and evidence_visible is not null and provenance_visible is not null and mutation_control_preserved is not null
      and correction_count is not null and elapsed_seconds is not null and target_met is not null and quality_gates_met is not null
      and estimated_minutes_saved is not null and assessment is not null and abandon_reason is null)
    or
    (status='abandoned' and abandoned_at is not null and completed_at is null and outcome_achieved is null
      and success_signal_ids is null and usefulness_rating is null and trust_rating is null and actionability_rating is null
      and evidence_visible is null and provenance_visible is null and mutation_control_preserved is null
      and correction_count is null and elapsed_seconds is not null and target_met is null and quality_gates_met is null
      and estimated_minutes_saved is null and assessment is null and abandon_reason is not null)
  )
);
create unique index bundle_value_pilot_one_active
  on workspace_private.bundle_value_pilot_sessions(workspace_id,user_id,bundle_key) where status='active';
create index bundle_value_pilot_history
  on workspace_private.bundle_value_pilot_sessions(workspace_id,user_id,started_at desc,id desc);
alter table workspace_private.bundle_value_pilot_sessions enable row level security;
revoke all on workspace_private.bundle_value_pilot_sessions from public,anon,authenticated;

create table workspace_private.bundle_value_pilot_receipts (
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  pilot_id uuid not null,
  input_hash text not null check (length(input_hash)=64),
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id,request_id),
  foreign key(workspace_id,user_id,pilot_id)
    references workspace_private.bundle_value_pilot_sessions(workspace_id,user_id,id) on delete restrict
);
alter table workspace_private.bundle_value_pilot_receipts enable row level security;
revoke all on workspace_private.bundle_value_pilot_receipts from public,anon,authenticated;

create function workspace_private.value_pilot_exact_keys(p_value jsonb,p_keys text[]) returns boolean
language sql immutable set search_path='' as $fn$
  select p_value is not null and jsonb_typeof(p_value)='object'
    and (select coalesce(array_agg(k order by k),'{}') from jsonb_object_keys(p_value) k)
      = (select array_agg(k order by k) from unnest(p_keys) k);
$fn$;
create function workspace_private.value_pilot_integer(p_value jsonb,p_min integer,p_max integer) returns boolean
language plpgsql immutable set search_path='' as $fn$
declare n numeric;
begin
  if p_value is null or jsonb_typeof(p_value)<>'number' then return false;end if;
  n:=(p_value#>>'{}')::numeric;
  return n=trunc(n) and n between p_min and p_max;
exception when others then return false;
end;$fn$;

create function workspace_private.require_bundle_value_pilot(p_bundle_key text) returns uuid
language plpgsql stable security definer set search_path='' as $fn$
declare target uuid; definition workspace_private.bundle_value_pilot_definitions%rowtype;
begin
  if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
    raise exception 'Value checks are private to the native owner workspace.' using errcode='42501';
  end if;
  target:=workspace_private.require_bundle_workspace();
  select * into definition from workspace_private.bundle_value_pilot_definitions where bundle_key=p_bundle_key;
  if definition.bundle_key is null then raise exception 'Choose an available bundle.' using errcode='22023';end if;
  if not exists(select 1 from unnest(definition.runtime_capability_ids) c
    where workspace_private.bundle_capability_active(target,p_bundle_key,c)) then
    raise exception 'This bundle is not currently available.' using errcode='42501';
  end if;
  return target;
end;$fn$;

create function workspace_private.bundle_value_pilot_json(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $fn$
  select jsonb_build_object(
    'schemaVersion','1.0','id',p.id,'bundleKey',p.bundle_key,'status',p.status,'version',p.version,
    'manifestVersion',p.manifest_version,'targetMinutes',p.target_minutes,'baselineMinutes',p.baseline_minutes,
    'availableSignalIds',to_jsonb(p.available_signal_ids),
    'requiredGates',jsonb_build_object('evidenceRequired',p.evidence_required,'provenanceRequired',p.provenance_required,
      'mutationConfirmationRequired',p.mutation_confirmation_required),
    'startedAt',p.started_at,'completedAt',p.completed_at,'abandonedAt',p.abandoned_at,
    'result',case when p.status='completed' then jsonb_build_object(
      'elapsedSeconds',p.elapsed_seconds,'outcomeAchieved',p.outcome_achieved,'successSignalIds',to_jsonb(p.success_signal_ids),
      'ratings',jsonb_build_object('usefulness',p.usefulness_rating,'trust',p.trust_rating,'actionability',p.actionability_rating),
      'gates',jsonb_build_object('evidenceVisible',p.evidence_visible,'provenanceVisible',p.provenance_visible,
        'mutationControlPreserved',p.mutation_control_preserved),
      'correctionCount',p.correction_count,'targetMet',p.target_met,'qualityGatesMet',p.quality_gates_met,
      'estimatedMinutesSaved',p.estimated_minutes_saved,'assessment',p.assessment) else null end,
    'abandonment',case when p.status='abandoned' then jsonb_build_object('reason',p.abandon_reason,'elapsedSeconds',p.elapsed_seconds) else null end,
    'receipt',p.receipt)
  from workspace_private.bundle_value_pilot_sessions p where p.id=p_id;
$fn$;

create function workspace.native_bundle_value_pilot_dashboard() returns jsonb
language plpgsql volatile security definer set search_path='' as $fn$
declare target uuid:=workspace_private.require_bundle_value_pilot('workspace_experience'); sessions jsonb;
begin
  select coalesce(jsonb_agg(workspace_private.bundle_value_pilot_json(x.id) order by x.started_at desc,x.id desc),'[]'::jsonb)
  into sessions from (select id,started_at from workspace_private.bundle_value_pilot_sessions
    where workspace_id=target and user_id=auth.uid() order by started_at desc,id desc limit 120) x;
  return jsonb_build_object('schemaVersion','1.0','generatedAt',now(),'sessions',sessions);
end;$fn$;

create function workspace.native_change_bundle_value_pilot(p_change jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $fn$
declare
  target uuid:=workspace_private.require_bundle_value_pilot('workspace_experience'); op text; request uuid; pilot uuid;
  expected integer; fingerprint text; prior record; response jsonb; definition workspace_private.bundle_value_pilot_definitions%rowtype;
  current workspace_private.bundle_value_pilot_sessions%rowtype; now_at timestamptz:=clock_timestamp(); elapsed integer;
  selected text[]; usefulness integer; trust integer; actionability integer; corrections integer;
  evidence boolean; provenance boolean; mutation_control boolean; achieved boolean; gates_met boolean;
  met_target boolean; estimated integer; pilot_assessment text; next_receipt jsonb; reason text;
begin
  if p_change is null or jsonb_typeof(p_change)<>'object' or jsonb_typeof(p_change->'operation')<>'string'
    or jsonb_typeof(p_change->'requestId')<>'string' or (p_change->>'requestId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Check the value-check request.' using errcode='22023';
  end if;
  op:=p_change->>'operation';request:=(p_change->>'requestId')::uuid;
  if op not in ('start','finish','abandon') then raise exception 'Choose a value-check operation.' using errcode='22023';end if;
  fingerprint:=encode(extensions.digest(p_change::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(target::text||':'||auth.uid()::text||':bundle-value-pilot',0));
  select * into prior from workspace_private.bundle_value_pilot_receipts
    where workspace_id=target and user_id=auth.uid() and request_id=request;
  if prior.request_id is not null then
    if prior.input_hash<>fingerprint then raise exception 'Request identity was already used for different value-check input.' using errcode='40001';end if;
    return prior.response_json;
  end if;

  if op='start' then
    if not workspace_private.value_pilot_exact_keys(p_change,array['operation','requestId','bundleKey','baselineMinutes'])
      or jsonb_typeof(p_change->'bundleKey')<>'string'
      or not workspace_private.value_pilot_integer(p_change->'baselineMinutes',1,480) then
      raise exception 'Set the usual-process estimate before starting.' using errcode='22023';
    end if;
    target:=workspace_private.require_bundle_value_pilot(p_change->>'bundleKey');
    select * into definition from workspace_private.bundle_value_pilot_definitions where bundle_key=p_change->>'bundleKey';
    if exists(select 1 from workspace_private.bundle_value_pilot_sessions where workspace_id=target and user_id=auth.uid()
      and bundle_key=definition.bundle_key and status='active') then
      raise exception 'Finish or stop the active value check before starting another.' using errcode='40001';
    end if;
    if (select count(*) from workspace_private.bundle_value_pilot_sessions where workspace_id=target and user_id=auth.uid()
      and bundle_key=definition.bundle_key and started_at>now()-interval '24 hours')>=10 then
      raise exception 'Wait before starting another value check for this bundle.' using errcode='22023';
    end if;
    next_receipt:=jsonb_build_object('requestId',request,'operation','start','version',1,'recordedAt',now_at);
    insert into workspace_private.bundle_value_pilot_sessions(workspace_id,user_id,bundle_key,status,version,manifest_version,
      target_minutes,baseline_minutes,available_signal_ids,evidence_required,provenance_required,mutation_confirmation_required,started_at,receipt)
    values(target,auth.uid(),definition.bundle_key,'active',1,definition.manifest_version,definition.target_minutes,
      (p_change->>'baselineMinutes')::int,definition.success_signal_ids,definition.evidence_required,definition.provenance_required,
      definition.mutation_confirmation_required,now_at,next_receipt) returning id into pilot;
  else
    if jsonb_typeof(p_change->'pilotId')<>'string' or (p_change->>'pilotId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or not workspace_private.value_pilot_integer(p_change->'expectedVersion',1,2147483647) then
      raise exception 'Choose the active value check and its current version.' using errcode='22023';
    end if;
    pilot:=(p_change->>'pilotId')::uuid;expected:=(p_change->>'expectedVersion')::int;
    select * into current from workspace_private.bundle_value_pilot_sessions
      where id=pilot and workspace_id=target and user_id=auth.uid() for update;
    if current.id is null then raise exception 'Value check unavailable.' using errcode='P0002';end if;
    if current.status<>'active' or current.version<>expected then raise exception 'The value check changed. Review its current result.' using errcode='40001';end if;
    elapsed:=least(604800,greatest(0,floor(extract(epoch from now_at-current.started_at))::int));
    if op='finish' then
      perform workspace_private.require_bundle_value_pilot(current.bundle_key);
      if not workspace_private.value_pilot_exact_keys(p_change,array['operation','requestId','pilotId','expectedVersion','outcomeAchieved','successSignalIds','ratings','gates','correctionCount'])
        or jsonb_typeof(p_change->'outcomeAchieved')<>'boolean' or jsonb_typeof(p_change->'successSignalIds')<>'array'
        or jsonb_array_length(p_change->'successSignalIds')>10
        or exists(select 1 from jsonb_array_elements(p_change->'successSignalIds') s where jsonb_typeof(s)<>'string')
        or not workspace_private.value_pilot_exact_keys(p_change->'ratings',array['usefulness','trust','actionability'])
        or not workspace_private.value_pilot_integer(p_change->'ratings'->'usefulness',1,5)
        or not workspace_private.value_pilot_integer(p_change->'ratings'->'trust',1,5)
        or not workspace_private.value_pilot_integer(p_change->'ratings'->'actionability',1,5)
        or not workspace_private.value_pilot_exact_keys(p_change->'gates',array['evidenceVisible','provenanceVisible','mutationControlPreserved'])
        or jsonb_typeof(p_change->'gates'->'evidenceVisible')<>'boolean'
        or jsonb_typeof(p_change->'gates'->'provenanceVisible')<>'boolean'
        or jsonb_typeof(p_change->'gates'->'mutationControlPreserved')<>'boolean'
        or not workspace_private.value_pilot_integer(p_change->'correctionCount',0,100) then
        raise exception 'Complete the bounded value-check ratings and trust checks.' using errcode='22023';
      end if;
      select coalesce(array_agg(s order by n),'{}') into selected from jsonb_array_elements_text(p_change->'successSignalIds') with ordinality x(s,n);
      achieved:=(p_change->>'outcomeAchieved')::boolean;
      if achieved<>(cardinality(selected)>0) or cardinality(selected)<>cardinality(array(select distinct unnest(selected)))
        or not selected<@current.available_signal_ids then
        raise exception 'Choose only current success signals that match the outcome.' using errcode='22023';
      end if;
      usefulness:=(p_change->'ratings'->>'usefulness')::int;trust:=(p_change->'ratings'->>'trust')::int;
      actionability:=(p_change->'ratings'->>'actionability')::int;corrections:=(p_change->>'correctionCount')::int;
      evidence:=(p_change->'gates'->>'evidenceVisible')::boolean;provenance:=(p_change->'gates'->>'provenanceVisible')::boolean;
      mutation_control:=(p_change->'gates'->>'mutationControlPreserved')::boolean;
      met_target:=elapsed<=current.target_minutes*60;
      gates_met:=(not current.evidence_required or evidence) and (not current.provenance_required or provenance)
        and (not current.mutation_confirmation_required or mutation_control);
      estimated:=greatest(0,current.baseline_minutes-ceil(elapsed/60.0)::int);
      pilot_assessment:=case when achieved and gates_met and least(usefulness,trust,actionability)>=4 then 'strong_signal'
        when achieved and gates_met and least(usefulness,trust,actionability)>=3 then 'promising_signal' else 'needs_iteration' end;
      next_receipt:=jsonb_build_object('requestId',request,'operation','finish','version',current.version+1,'recordedAt',now_at);
      update workspace_private.bundle_value_pilot_sessions set status='completed',version=version+1,completed_at=now_at,
        outcome_achieved=achieved,success_signal_ids=selected,usefulness_rating=usefulness,trust_rating=trust,
        actionability_rating=actionability,evidence_visible=evidence,provenance_visible=provenance,
        mutation_control_preserved=mutation_control,correction_count=corrections,elapsed_seconds=elapsed,target_met=met_target,
        quality_gates_met=gates_met,estimated_minutes_saved=estimated,assessment=pilot_assessment,receipt=next_receipt where id=pilot;
    else
      if not workspace_private.value_pilot_exact_keys(p_change,array['operation','requestId','pilotId','expectedVersion','reason'])
        or jsonb_typeof(p_change->'reason')<>'string' or p_change->>'reason' not in ('interrupted','outcome_unclear','source_gap','workflow_friction','other') then
        raise exception 'Choose why the value check stopped.' using errcode='22023';
      end if;
      reason:=p_change->>'reason';
      next_receipt:=jsonb_build_object('requestId',request,'operation','abandon','version',current.version+1,'recordedAt',now_at);
      update workspace_private.bundle_value_pilot_sessions set status='abandoned',version=version+1,abandoned_at=now_at,
        elapsed_seconds=elapsed,abandon_reason=reason,receipt=next_receipt where id=pilot;
    end if;
  end if;
  response:=workspace_private.bundle_value_pilot_json(pilot);
  insert into workspace_private.bundle_value_pilot_receipts(workspace_id,user_id,request_id,pilot_id,input_hash,response_json)
    values(target,auth.uid(),request,pilot,fingerprint,response);
  return response;
end;$fn$;

revoke all on function workspace_private.value_pilot_exact_keys(jsonb,text[]),workspace_private.value_pilot_integer(jsonb,integer,integer),
  workspace_private.require_bundle_value_pilot(text),workspace_private.bundle_value_pilot_json(uuid) from public,anon,authenticated;
revoke all on function workspace.native_bundle_value_pilot_dashboard(),workspace.native_change_bundle_value_pilot(jsonb) from public,anon;
grant execute on function workspace.native_bundle_value_pilot_dashboard(),workspace.native_change_bundle_value_pilot(jsonb) to authenticated;

comment on table workspace_private.bundle_value_pilot_sessions is
  'Private metadata-only first-value measurements; never client work, prompts, source excerpts or output prose.';
