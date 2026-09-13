-- SOTF v1 accepts the exact 418-name intersection of IANA 2025b zone.tab
-- primary identifiers plus UTC with the pinned JavaScript/PostgreSQL runtime catalogs.
-- Runtime-specific links and compatibility namespaces are outside the contract.
create table workspace_private.sotf_v1_canonical_time_zones (
  name text primary key
);

alter table workspace_private.sotf_v1_canonical_time_zones enable row level security;
revoke all on table workspace_private.sotf_v1_canonical_time_zones from public,anon,authenticated;

insert into workspace_private.sotf_v1_canonical_time_zones(name)
select value
from pg_catalog.jsonb_array_elements_text($time_zones$["Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Asmara","Africa/Bamako","Africa/Bangui","Africa/Banjul","Africa/Bissau","Africa/Blantyre","Africa/Brazzaville","Africa/Bujumbura","Africa/Cairo","Africa/Casablanca","Africa/Ceuta","Africa/Conakry","Africa/Dakar","Africa/Dar_es_Salaam","Africa/Djibouti","Africa/Douala","Africa/El_Aaiun","Africa/Freetown","Africa/Gaborone","Africa/Harare","Africa/Johannesburg","Africa/Juba","Africa/Kampala","Africa/Khartoum","Africa/Kigali","Africa/Kinshasa","Africa/Lagos","Africa/Libreville","Africa/Lome","Africa/Luanda","Africa/Lubumbashi","Africa/Lusaka","Africa/Malabo","Africa/Maputo","Africa/Maseru","Africa/Mbabane","Africa/Mogadishu","Africa/Monrovia","Africa/Nairobi","Africa/Ndjamena","Africa/Niamey","Africa/Nouakchott","Africa/Ouagadougou","Africa/Porto-Novo","Africa/Sao_Tome","Africa/Tripoli","Africa/Tunis","Africa/Windhoek","America/Adak","America/Anchorage","America/Anguilla","America/Antigua","America/Araguaina","America/Argentina/Buenos_Aires","America/Argentina/Catamarca","America/Argentina/Cordoba","America/Argentina/Jujuy","America/Argentina/La_Rioja","America/Argentina/Mendoza","America/Argentina/Rio_Gallegos","America/Argentina/Salta","America/Argentina/San_Juan","America/Argentina/San_Luis","America/Argentina/Tucuman","America/Argentina/Ushuaia","America/Aruba","America/Asuncion","America/Atikokan","America/Bahia","America/Bahia_Banderas","America/Barbados","America/Belem","America/Belize","America/Blanc-Sablon","America/Boa_Vista","America/Bogota","America/Boise","America/Cambridge_Bay","America/Campo_Grande","America/Cancun","America/Caracas","America/Cayenne","America/Cayman","America/Chicago","America/Chihuahua","America/Ciudad_Juarez","America/Costa_Rica","America/Creston","America/Cuiaba","America/Curacao","America/Danmarkshavn","America/Dawson","America/Dawson_Creek","America/Denver","America/Detroit","America/Dominica","America/Edmonton","America/Eirunepe","America/El_Salvador","America/Fort_Nelson","America/Fortaleza","America/Glace_Bay","America/Goose_Bay","America/Grand_Turk","America/Grenada","America/Guadeloupe","America/Guatemala","America/Guayaquil","America/Guyana","America/Halifax","America/Havana","America/Hermosillo","America/Indiana/Indianapolis","America/Indiana/Knox","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Tell_City","America/Indiana/Vevay","America/Indiana/Vincennes","America/Indiana/Winamac","America/Inuvik","America/Iqaluit","America/Jamaica","America/Juneau","America/Kentucky/Louisville","America/Kentucky/Monticello","America/Kralendijk","America/La_Paz","America/Lima","America/Los_Angeles","America/Lower_Princes","America/Maceio","America/Managua","America/Manaus","America/Marigot","America/Martinique","America/Matamoros","America/Mazatlan","America/Menominee","America/Merida","America/Metlakatla","America/Mexico_City","America/Miquelon","America/Moncton","America/Monterrey","America/Montevideo","America/Montserrat","America/Nassau","America/New_York","America/Nome","America/Noronha","America/North_Dakota/Beulah","America/North_Dakota/Center","America/North_Dakota/New_Salem","America/Nuuk","America/Ojinaga","America/Panama","America/Paramaribo","America/Phoenix","America/Port_of_Spain","America/Port-au-Prince","America/Porto_Velho","America/Puerto_Rico","America/Punta_Arenas","America/Rankin_Inlet","America/Recife","America/Regina","America/Resolute","America/Rio_Branco","America/Santarem","America/Santiago","America/Santo_Domingo","America/Sao_Paulo","America/Scoresbysund","America/Sitka","America/St_Barthelemy","America/St_Johns","America/St_Kitts","America/St_Lucia","America/St_Thomas","America/St_Vincent","America/Swift_Current","America/Tegucigalpa","America/Thule","America/Tijuana","America/Toronto","America/Tortola","America/Vancouver","America/Whitehorse","America/Winnipeg","America/Yakutat","Antarctica/Casey","Antarctica/Davis","Antarctica/DumontDUrville","Antarctica/Macquarie","Antarctica/Mawson","Antarctica/McMurdo","Antarctica/Palmer","Antarctica/Rothera","Antarctica/Syowa","Antarctica/Troll","Antarctica/Vostok","Arctic/Longyearbyen","Asia/Aden","Asia/Almaty","Asia/Amman","Asia/Anadyr","Asia/Aqtau","Asia/Aqtobe","Asia/Ashgabat","Asia/Atyrau","Asia/Baghdad","Asia/Bahrain","Asia/Baku","Asia/Bangkok","Asia/Barnaul","Asia/Beirut","Asia/Bishkek","Asia/Brunei","Asia/Chita","Asia/Colombo","Asia/Damascus","Asia/Dhaka","Asia/Dili","Asia/Dubai","Asia/Dushanbe","Asia/Famagusta","Asia/Gaza","Asia/Hebron","Asia/Ho_Chi_Minh","Asia/Hong_Kong","Asia/Hovd","Asia/Irkutsk","Asia/Jakarta","Asia/Jayapura","Asia/Jerusalem","Asia/Kabul","Asia/Kamchatka","Asia/Karachi","Asia/Kathmandu","Asia/Khandyga","Asia/Kolkata","Asia/Krasnoyarsk","Asia/Kuala_Lumpur","Asia/Kuching","Asia/Kuwait","Asia/Macau","Asia/Magadan","Asia/Makassar","Asia/Manila","Asia/Muscat","Asia/Nicosia","Asia/Novokuznetsk","Asia/Novosibirsk","Asia/Omsk","Asia/Oral","Asia/Phnom_Penh","Asia/Pontianak","Asia/Pyongyang","Asia/Qatar","Asia/Qostanay","Asia/Qyzylorda","Asia/Riyadh","Asia/Sakhalin","Asia/Samarkand","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Srednekolymsk","Asia/Taipei","Asia/Tashkent","Asia/Tbilisi","Asia/Tehran","Asia/Thimphu","Asia/Tokyo","Asia/Tomsk","Asia/Ulaanbaatar","Asia/Urumqi","Asia/Ust-Nera","Asia/Vientiane","Asia/Vladivostok","Asia/Yakutsk","Asia/Yangon","Asia/Yekaterinburg","Asia/Yerevan","Atlantic/Azores","Atlantic/Bermuda","Atlantic/Canary","Atlantic/Cape_Verde","Atlantic/Faroe","Atlantic/Madeira","Atlantic/Reykjavik","Atlantic/South_Georgia","Atlantic/St_Helena","Atlantic/Stanley","Australia/Adelaide","Australia/Brisbane","Australia/Broken_Hill","Australia/Darwin","Australia/Eucla","Australia/Hobart","Australia/Lindeman","Australia/Lord_Howe","Australia/Melbourne","Australia/Perth","Australia/Sydney","Europe/Amsterdam","Europe/Andorra","Europe/Astrakhan","Europe/Athens","Europe/Belgrade","Europe/Berlin","Europe/Bratislava","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Busingen","Europe/Chisinau","Europe/Copenhagen","Europe/Dublin","Europe/Gibraltar","Europe/Guernsey","Europe/Helsinki","Europe/Isle_of_Man","Europe/Istanbul","Europe/Jersey","Europe/Kaliningrad","Europe/Kirov","Europe/Kyiv","Europe/Lisbon","Europe/Ljubljana","Europe/London","Europe/Luxembourg","Europe/Madrid","Europe/Malta","Europe/Mariehamn","Europe/Minsk","Europe/Monaco","Europe/Moscow","Europe/Oslo","Europe/Paris","Europe/Podgorica","Europe/Prague","Europe/Riga","Europe/Rome","Europe/Samara","Europe/San_Marino","Europe/Sarajevo","Europe/Saratov","Europe/Simferopol","Europe/Skopje","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Tirane","Europe/Ulyanovsk","Europe/Vaduz","Europe/Vatican","Europe/Vienna","Europe/Vilnius","Europe/Volgograd","Europe/Warsaw","Europe/Zagreb","Europe/Zurich","Indian/Antananarivo","Indian/Chagos","Indian/Christmas","Indian/Cocos","Indian/Comoro","Indian/Kerguelen","Indian/Mahe","Indian/Maldives","Indian/Mauritius","Indian/Mayotte","Indian/Reunion","Pacific/Apia","Pacific/Auckland","Pacific/Bougainville","Pacific/Chatham","Pacific/Chuuk","Pacific/Easter","Pacific/Efate","Pacific/Fakaofo","Pacific/Fiji","Pacific/Funafuti","Pacific/Galapagos","Pacific/Gambier","Pacific/Guadalcanal","Pacific/Guam","Pacific/Honolulu","Pacific/Kanton","Pacific/Kiritimati","Pacific/Kosrae","Pacific/Kwajalein","Pacific/Majuro","Pacific/Marquesas","Pacific/Midway","Pacific/Nauru","Pacific/Niue","Pacific/Norfolk","Pacific/Noumea","Pacific/Pago_Pago","Pacific/Palau","Pacific/Pitcairn","Pacific/Pohnpei","Pacific/Port_Moresby","Pacific/Rarotonga","Pacific/Saipan","Pacific/Tahiti","Pacific/Tarawa","Pacific/Tongatapu","Pacific/Wake","Pacific/Wallis","UTC"]$time_zones$::jsonb) zone(value);

do $contract_check$
begin
  if (select count(*) from workspace_private.sotf_v1_canonical_time_zones) <> 418
    or exists (
      select 1
      from workspace_private.sotf_v1_canonical_time_zones zone
      where not exists (
        select 1 from pg_catalog.pg_timezone_names supported where supported.name = zone.name
      )
    )
  then
    raise exception 'sotf_v1:canonical_time_zone_contract_unavailable' using errcode = '55000';
  end if;
end;
$contract_check$;

create function workspace_private.sotf_v1_time_zone_is_canonical(target_time_zone text)
returns boolean language sql stable strict security definer set search_path = '' as $$
  select exists (
    select 1
    from workspace_private.sotf_v1_canonical_time_zones zone
    where zone.name = target_time_zone
  );
$$;

revoke all on function workspace_private.sotf_v1_time_zone_is_canonical(text)
  from public,anon,authenticated;

comment on table workspace_private.sotf_v1_canonical_time_zones is
  'Frozen 418-name JavaScript/PostgreSQL intersection from IANA 2025b zone.tab primary identifiers plus UTC; America/Coyhaique is unavailable in the pinned PostgreSQL catalog.';

comment on function workspace_private.sotf_v1_time_zone_is_canonical(text) is
  'Exact SOTF v1 canonical time-zone membership; compatibility aliases are rejected.';

create or replace function workspace_private.validate_sotf_v1_daily_brief_outcome(outcome jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  connector jsonb;
  reason text;
  reference jsonb;
  reference_count integer;
  required_reason text;
  complete boolean;
begin
  if jsonb_typeof(outcome) is distinct from 'object' then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;
  if octet_length(outcome::text) > 8192
    or (select count(*) from jsonb_object_keys(outcome)) <> 19
    or not outcome ?& array[
      'schema_version','request_id','run_id','workflow_id','workflow_version','expected_state_revision',
      'brief_date','time_zone','host','execution_mode','data_class','user_confirmed','status',
      'connector_results','degradation_reasons','selected_le_refs','priority_count','usefulness','provenance'
    ]
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  if jsonb_typeof(outcome -> 'schema_version') is distinct from 'string'
    or outcome ->> 'schema_version' is distinct from '1'
    or jsonb_typeof(outcome -> 'workflow_id') is distinct from 'string'
    or outcome ->> 'workflow_id' is distinct from 'transition.daily_brief'
    or jsonb_typeof(outcome -> 'workflow_version') is distinct from 'string'
    or outcome ->> 'workflow_version' is distinct from '1.0.0'
    or jsonb_typeof(outcome -> 'host') is distinct from 'string'
    or outcome ->> 'host' is distinct from 'chatgpt'
    or jsonb_typeof(outcome -> 'execution_mode') is distinct from 'string'
    or outcome ->> 'execution_mode' is distinct from 'A'
    or jsonb_typeof(outcome -> 'data_class') is distinct from 'string'
    or outcome ->> 'data_class' is distinct from 'ordinary_transition_operations'
    or outcome -> 'user_confirmed' is distinct from 'true'::jsonb
    or jsonb_typeof(outcome -> 'status') is distinct from 'string'
    or outcome ->> 'status' not in ('completed','degraded')
    or jsonb_typeof(outcome -> 'usefulness') is distinct from 'string'
    or outcome ->> 'usefulness' not in ('useful','not_useful','not_rated')
    or jsonb_typeof(outcome -> 'request_id') is distinct from 'string'
    or outcome ->> 'request_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(outcome -> 'run_id') is distinct from 'string'
    or outcome ->> 'run_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(outcome -> 'expected_state_revision') is distinct from 'number'
    or outcome ->> 'expected_state_revision' !~ '^[0-9]{1,4}$'
    or jsonb_typeof(outcome -> 'brief_date') is distinct from 'string'
    or outcome ->> 'brief_date' !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(outcome -> 'time_zone') is distinct from 'string'
    or workspace_private.sotf_v1_text_units(outcome ->> 'time_zone') not between 1 and 80
    or not workspace_private.sotf_v1_time_zone_is_canonical(outcome ->> 'time_zone')
    or jsonb_typeof(outcome -> 'priority_count') is distinct from 'number'
    or outcome ->> 'priority_count' !~ '^[0-3]$'
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  begin
    if (outcome ->> 'expected_state_revision')::integer not between 0 and 2000 then
      raise exception 'sotf_v1:invalid_input' using errcode = '22023';
    end if;
    perform (outcome ->> 'brief_date')::date;
    perform (outcome ->> 'request_id')::uuid;
    perform (outcome ->> 'run_id')::uuid;
  exception when others then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end;

  connector := outcome -> 'connector_results';
  if jsonb_typeof(connector) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(connector)) <> 2
    or not connector ?& array['calendar_read','email_read']
    or jsonb_typeof(connector -> 'calendar_read') is distinct from 'string'
    or connector ->> 'calendar_read' not in ('used','not_available','failed','not_requested')
    or jsonb_typeof(connector -> 'email_read') is distinct from 'string'
    or connector ->> 'email_read' not in ('used','not_available','failed','not_requested')
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  if jsonb_typeof(outcome -> 'degradation_reasons') is distinct from 'array'
    or jsonb_array_length(outcome -> 'degradation_reasons') > 5
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  for reason in select jsonb_array_elements_text(outcome -> 'degradation_reasons') loop
    if reason is null
      or reason not in ('calendar_unavailable','calendar_failed','email_unavailable','email_failed','state_truncated')
    then
      raise exception 'sotf_v1:invalid_input' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements_text(outcome -> 'degradation_reasons'))
    <> (select count(distinct value) from jsonb_array_elements_text(outcome -> 'degradation_reasons') as value)
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;

  foreach required_reason in array array['calendar_unavailable','calendar_failed','email_unavailable','email_failed'] loop
    if ((required_reason = 'calendar_unavailable' and connector ->> 'calendar_read' = 'not_available')
      or (required_reason = 'calendar_failed' and connector ->> 'calendar_read' = 'failed')
      or (required_reason = 'email_unavailable' and connector ->> 'email_read' = 'not_available')
      or (required_reason = 'email_failed' and connector ->> 'email_read' = 'failed'))
      is distinct from (outcome -> 'degradation_reasons' ? required_reason)
    then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  end loop;
  complete := connector ->> 'calendar_read' = 'used' and connector ->> 'email_read' = 'used'
    and jsonb_array_length(outcome -> 'degradation_reasons') = 0;
  if (outcome ->> 'status' = 'completed') is distinct from complete then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;

  if jsonb_typeof(outcome -> 'selected_le_refs') is distinct from 'array'
    or jsonb_array_length(outcome -> 'selected_le_refs') > 3
    or jsonb_array_length(outcome -> 'selected_le_refs') > (outcome ->> 'priority_count')::integer
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  for reference in select value from jsonb_array_elements(outcome -> 'selected_le_refs') loop
    if jsonb_typeof(reference) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(reference)) <> 2
      or not reference ?& array['entity_type','entity_id']
      or jsonb_typeof(reference -> 'entity_type') is distinct from 'string'
      or reference ->> 'entity_type' not in ('criterion','opportunity','commitment','meeting','hypothesis')
      or jsonb_typeof(reference -> 'entity_id') is distinct from 'string'
      or workspace_private.sotf_v1_text_units(reference ->> 'entity_id') not between 1 and 100
    then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
  end loop;
  select count(*) into reference_count from (
    select distinct value ->> 'entity_type', value ->> 'entity_id'
    from jsonb_array_elements(outcome -> 'selected_le_refs')
  ) as unique_reference;
  if reference_count <> jsonb_array_length(outcome -> 'selected_le_refs') then
    raise exception 'sotf_v1:invalid_input' using errcode = '22023';
  end if;

  if jsonb_typeof(outcome -> 'provenance') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(outcome -> 'provenance')) <> 2
    or jsonb_typeof(outcome #> '{provenance,source}') is distinct from 'string'
    or outcome #>> '{provenance,source}' is distinct from 'host_reported_user_confirmed'
    or outcome #> '{provenance,provider_content_persisted}' is distinct from 'false'::jsonb
  then raise exception 'sotf_v1:invalid_input' using errcode = '22023'; end if;
end; $$;

alter table workspace_private.sotf_daily_brief_outcomes
  add constraint sotf_daily_brief_outcomes_canonical_time_zone
  check (workspace_private.sotf_v1_time_zone_is_canonical(time_zone));

revoke all on function workspace_private.validate_sotf_v1_daily_brief_outcome(jsonb)
  from public,anon,authenticated;
