# User-owned layout boundary

Workspace Experience is an optional, ordinarily assigned bundle. Its current
native capabilities are `workspace.compose` and `workspace.personalize`.
An operator can assign/remove the bundle using existing entitlement operations;
individual users are never hardcoded into product code.

## Two independent revisions

1. `get_bundle_experience` resolves the verified subject's assignments and
   admitted capabilities. Its revision remains the key used by domain editors.
2. Native `get_workspace_layout` resolves that owner's preference revision,
   history and the current authority revision.
3. The native adapter composes the user layout only after capability filtering
   and only when both authority snapshots agree.
4. A native save requires the displayed preference revision, displayed authority
   revision, a request ID, strict preferences and explicit confirmation.
5. The database serializes saves per workspace and records a new immutable
   version. A response retry can retrieve only the same current saved result.

Layout changes never augment capabilities, alter source-sharing grants, modify
domain data, add model tools, or change the authority/editor revision.

## Boundaries

`workspace_private.layout_contributions` lists implemented customizable
navigation/cards and their capability gates. Its ten identities/routes are
independently compared with the all-six native catalog in actual acceptance.
The portable composer is not an authorization system; it receives already
filtered contributions.

`layout_preferences` and `layout_versions` have no direct app-role access.
RPCs require a native session, owner membership, active Personal access and
active layout capability. Actual OAuth credentials cannot invoke these native
reads/writes even when all six bundles are assigned.

There is no model-persistence endpoint. The skill may suggest changes, but
only a user-confirmed native request saves them. Configured search/attention
metadata is not evidence that those planned consumers are implemented.

## Recovery and unavailable state

Home, Settings and the recovery page are not customizable contributions.
Hidden items remain listed in the layout editor so the user can restore them.
A hidden default route is still valid when authorized; an unassigned default
falls back to Home without erasing the user's saved choice.

Dormant settings may be retained or removed, but not newly added/changed while
unavailable. Unavailable labels are not introduced into the admitted catalog.
A stale tab must reload/review; it cannot overwrite a newer preference revision.
Selecting old history or defaults creates an unsaved draft.

The native resolver preserves valid authority during a preferences outage,
withholds unverified navigation/cards, and exposes a retry state. It does not
silently reset the saved layout or blank an authorized open domain editor.
An uncertain write response does not claim that nothing was saved.

## Sign-in

Only missing/empty return destinations use `/workspace/start`. That page
uses the verified default only for a successfully loaded personalized layout.
Explicit Home/deep links continue through the existing safe path normalizer.
Unassigned users retain Home as their normal start; failed verification offers
retry or an explicit Home escape. No external route is accepted as a default.

See [acceptance evidence](../testing/workspace-layout-acceptance.md).
