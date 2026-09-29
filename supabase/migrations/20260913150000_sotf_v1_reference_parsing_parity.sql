-- Authority-sensitive references are decoded JSON identities. Eligibility is
-- exact: no trimming, case folding, Unicode normalization, or alias mapping.
create function workspace_private.sotf_v1_reference_is_eligible(
  eligible_refs jsonb,
  reference jsonb
)
returns boolean language sql immutable strict parallel safe set search_path = '' as $$
  select coalesce(eligible_refs @> jsonb_build_array(reference),false);
$$;

revoke all on function workspace_private.sotf_v1_reference_is_eligible(jsonb,jsonb)
  from public,anon,authenticated;

comment on function workspace_private.sotf_v1_reference_is_eligible(jsonb,jsonb) is
  'Exact decoded-string SOTF v1 reference membership; performs no normalization or whitespace transformation.';

create or replace function workspace_private.validate_sotf_v1_daily_brief_projection_semantics(
  outcome jsonb,
  target_workspace uuid
)
returns void language plpgsql stable security definer set search_path = '' as $$
declare semantics jsonb;
declare reference jsonb;
begin
  semantics := workspace_private.sotf_v1_daily_brief_projection_semantics(
    target_workspace,(outcome ->> 'brief_date')::date,outcome ->> 'time_zone'
  );
  if (jsonb_array_length(semantics -> 'truncated_sections') > 0)
    is distinct from (outcome -> 'degradation_reasons' ? 'state_truncated')
  then raise exception 'sotf_v1:invalid_input' using errcode='22023'; end if;
  for reference in select value from jsonb_array_elements(outcome -> 'selected_le_refs') loop
    if not workspace_private.sotf_v1_reference_is_eligible(semantics -> 'eligible_refs',reference) then
      raise exception 'sotf_v1:invalid_input' using errcode='22023';
    end if;
  end loop;
end; $$;
