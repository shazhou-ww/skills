---
name: shazhou-cli-design
description: "Model CLI requirements through step-by-step user confirmation, then generate and discuss a concrete HTML CLI Spec: command tree, per-command parameters, expected outputs, and examples. Use for CLI requirements discovery, redesign analysis, and collaboratively confirmed specifications. Propose, revise, record, and automatically advance after explicit approval; do not implement code. Complements cli-design."
---

# Shazhou CLI Design

Conduct progressive requirements confirmation, not a questionnaire-led interview.
For each step, first propose your understanding, revise it with the user's
feedback, and advance only after the user explicitly says OK or an unambiguous
equivalent for that step. Record agreements, then automatically turn the
confirmed requirements into an HTML CLI Spec draft for further discussion.

## Two modeling levels

At the CLI level, discover users and their primary scenarios. A user can have
several primary scenarios, and a CLI can aggregate several scenario models.
Do not force all needs into one primary scenario.

At the scenario level, fix one user goal and analyze its task, parameters,
user-level values, and supporting resources. Then consolidate auxiliary
management needs across scenarios for the same user role.

Human, AI agent, and CI are interaction contexts, not automatically different
business roles. JSON, text, TUI, command names, and flags are not the starting
point of requirements discovery.

This skill has two phases: requirements modeling, then concrete CLI interface
design. Neither authorizes implementation. Load the separate `cli-design`
skill for command syntax, help, streams, exit codes, prompts, and interaction
conventions in the design phase. Preserve explicitly agreed product choices
instead of replacing them with generic defaults. Do not modify that skill.

## Proposal, revision, confirmation, and recording

1. Read the relevant conversation and existing modeling record. Inspect enough
   documentation or code to form a grounded proposal for the current step.
   Existing implementation is evidence, not the desired model.
2. Identify the current step and reuse prior answers and explicit approvals.
   Do not restart agreed work or ask the user to produce a model from scratch.
3. Present your proposed understanding of this step before requesting feedback:
   its scope, draft conclusion or table, brief reasoning, and any uncertainty.
   Cover only the current step, not an entire five-step report.
   Keep every round concise and include only information necessary for the
   current decision. Do not repeat confirmed context or unrelated steps.
   For revisions, show the changes and only enough context to assess them;
   repeat the full proposal only when needed for clarity or requested.
4. Present complete proposals, tables, and revisions as readable Markdown in
   the conversation, not inside Ask User forms. After each proposal, offer
   only one predefined confirmation choice: `同意`. VS Code provides an
   additional freeform input option; use that for feedback instead of adding
   a separate disagreement or feedback choice.
   When using a question tool, keep only this short confirmation there.
   Accept direct conversational
   approval or feedback too; do not make the user repeat an answer in a form.
   `同意` or an explicit conversational OK approves the current step.
   Feedback keeps it open: incorporate the feedback, present a revised
   proposal, and offer the same single predefined confirmation choice.
   If feedback has not yet been provided, wait for it rather than advancing.
   A pause or cancellation is never approval.
5. Suggestions and alternatives remain welcome. Present them as readable options
   in the conversation, explaining your recommendation and tradeoffs. Indicate
   which alternatives are mutually exclusive and which may be combined; these
   do not require single-select or multi-select widgets. Selecting details helps
   revise the draft but does not by itself approve the entire step.
6. When the user requests changes, incorporate them, record the feedback, and
   present the revised understanding of the same step. Repeat this loop until
   the user explicitly says OK or clearly approves that step. Never treat
   silence, a declined question, an edit request, or your own confidence as OK.
   An approval qualified by a substantive change requires a revised proposal
   unless the user explicitly authorizes proceeding with that exact change.
7. Record the approved conclusion and approval source, then advance to the next
   step automatically in the same response cycle: present its concise proposal
   and request confirmation. Approval is sufficient authorization to continue
   modeling; do not stop at an acknowledgment, ask whether to continue, or wait
   for another instruction. After the fifth modeling approval, synthesize the
   requirements and automatically generate the HTML Spec draft. After the last
   design approval, finalize the Spec without starting implementation.
   Do not silently add requirements after approval. Keep later steps on hold
   while the current step is awaiting confirmation.
8. If new feedback changes an approved conclusion, reopen the affected step,
   keep a short supersession note, and flag dependent conclusions for review.
   Preserve unaffected approvals. If the user pauses, save state and stop.
9. After all five steps are explicitly approved, synthesize the requirements
   record and enter the CLI Spec design phase below without another instruction.
   Deferred questions may remain only where the user explicitly accepted that
   boundary; never turn unresolved proposals into confirmed requirements.

The questions in the five steps below guide the agent's analysis and proposal.
They are not a script to ask the user one by one. Ask a focused factual question
only when missing evidence prevents a meaningful proposal.

### Modeling record

Use the session's persistent workspace or structured session storage for the
working record. If the user has selected an existing document as the record,
update it instead. Do not create planning files in the repository by default.
If persistent session storage is unavailable, maintain an explicit conversation
checkpoint and be clear about that limitation.

Keep the record concise, not a transcript. Include:

- Target CLI, report language, authorized document destination if known.
- Current step, current role/scenario, and the current proposal.
- Per-step state: draft, awaiting confirmation, confirmed, or reopened.
- Stable role, scenario, parameter, and resource identifiers as needed for links.
- Confirmed conclusions and the user's explicit approval of the applicable
  proposal; observed implementation facts remain separately identified evidence.
- Proposals, deferred decisions, rejected options, and affected dependencies.
- Scenario-to-parameter and scenario-to-resource relationships.

Record requirements about credentials, never actual secrets or unnecessary
personal data. A skill invocation does not authorize implementation, a new Idea,
commits, publishing, or acceptance of any repository lifecycle gate.

## Step 1. Who is this for?

Discover the business roles, their context, and the intended CLI boundary.

Propose who uses the tool, what responsibilities they have, and which work
belongs to other tools or systems. Distinguish the role from the person,
transport, or presentation mode, then seek confirmation.

Record the agreed role list and boundaries. If several roles emerge, preserve
them separately rather than declaring one a secondary user without discussion.

## Step 2. What primary scenarios do these users have?

For each role, discover independently valuable goals:

- What is the user trying to achieve, and what triggers this need?
- What observable result means the scenario is complete?
- Is this an independent goal, an internal step, or management of a resource
  supporting another goal?
- Must the user participate outside the CLI between stages?

Record each confirmed scenario's owner, goal, completion criterion, non-goals,
and necessary external handoffs. A shared scenario may reference several roles.

Do not derive scenarios directly from existing commands or library functions.
Do not invent an independent check or dry-run merely because validation code
exists. Internal validation and useful diagnostics may already satisfy the need.
Independent inspection or debugging becomes a primary scenario only when the
user needs its result independently of construction or execution.

Classify services by purpose and ownership. An on-demand service automatically
created, reused, and stopped to execute tasks can be an application resource.
Providing an HTTP execution service to other applications can instead be an
independent goal when service availability is itself the requested outcome.
Neither classification is universal; establish the user's intent.

External participation can split one scenario into implementation stages.
For example, project initialization, user editing outside the CLI, and building
have a genuine handoff. Compilation and archive encoding alone do not: output
variants can be parameters rather than separate user scenarios.

## Step 3. Model parameters for each primary scenario

Work through confirmed scenarios one at a time. Discover the full parameter
inventory before minimizing mandatory user decisions.

Consider:

- Target identity and business input.
- Content sources, service endpoints, and identity or authentication context.
- Authorization policies, time and resource budgets.
- Output targets, artifact forms, and delivery preferences.
- Application data folders, recording, retention, and privacy policies.

Only include applicable concerns. Do not invent persistence to justify a data
folder or expose implementation knobs simply because they exist.
Describe each business parameter once; alternative representations, derived
identities, and consistency checks do not automatically add business parameters.

### Three default layers

For ordinary scenario parameters, use exactly these three classifications:

| Class | Product default | User-level configuration | Meaning |
|-------|-----------------|--------------------------|---------|
| Task-specific | N | N | The task must supply a value. |
| User-specific | N | Y | The user can set a reusable value; otherwise the task must supply it. |
| Product-defaulted | Y | Y | The product supplies a default, the user can override it, and the task can override both. |

Conceptually: task-specific value > user-level value > product default.
"Product default" means a built-in global default, not a machine-level config
file. "User-level configuration: Y" means support for a reusable user value,
not proof that the user has already configured one.

Do not retain Y/N as a fourth ordinary-parameter class. If it appears necessary,
discuss whether the item is actually a change of purpose, a fixed behavioral
guarantee, or a misunderstood parameter.

Authorized users may configure reusable authorization policies. Validate their
authority and the policy's scope; do not reject user-level configuration solely
because a value concerns permissions. Fixed correctness guarantees, such as not
fabricating success, are constraints rather than configurable parameters.

Modes that change the purpose, such as execution versus rehearsal, require
separate scenario analysis; do not force them into the default-layer table or
assume a dry-run feature must exist.

For every candidate parameter, discuss whether it can have a meaningful default
and whether users have a reusable value. Do not confuse "not implemented today"
with "cannot have a product default." The requirements stage can confirm a
default exists without choosing its exact value. No default does not mean users
must type it repeatedly: an existing task description can already supply it.

### Parameter table

| Parameter | Description | Product default | User-level configuration |
|-----------|-------------|-----------------|--------------------------|

Use only `Y` and `N` in the last two columns, regardless of report language.
Keep business meaning in the description. Do not add flags, input channels,
environment variables, configuration paths, lookup mechanisms, or a required-input
column. Discuss unresolved classifications outside the table rather than
guessing a Y/N answer. Confirmed rows must use one of the three valid pairs.

Record reusable values for later consolidation, including whether they are
ordinary Config or sensitive Credential candidates.

## Step 4. Identify each scenario's supporting resources

For each scenario, ask what it creates, acquires, or retains to achieve its goal:

- Which resources belong to the CLI application?
- Which are user-owned deliverables or externally owned resources?
- What creates each resource, and when is it no longer needed?
- Can lifecycle management be automatic?
- What would the user actually need to inspect, reuse, export, stop, or delete?

Include both persistent data and live resources such as services. Distinguish
automatic cleanup from a justified user-facing management scenario. Do not
assume every resource needs a command.

Record ownership, lifetime, privacy or safety boundaries, and tentative query
and management needs. Do not create history databases, caches, or services just
to fill the model. A data folder is a parameter from step 3; its contents are
resources here.

## Step 5. Consolidate auxiliary scenarios for each user role

Only after individual scenarios are understood, aggregate their user-level
parameters and supporting resources for that role.

- Merge genuinely shared values and resources by meaning, scope, and ownership,
  not merely by matching names.
- Record which primary scenarios each shared value or resource serves.
- Define coherent configuration, credential, query, and lifecycle management
  scenarios; avoid duplicate per-scenario management interfaces.
- Preserve separate management where ownership, sensitivity, or semantics differ.
- Consider cross-role sharing explicitly rather than treating all users alike.

Separate ordinary Config and Credential management by sensitivity and purpose:

- Config supports justified inspection, setting, updating, and resetting.
- Credential management supports the actual authentication lifecycle and only
  exposes safe status, identity, or target metadata, never secret values.
- Require different storage protection and command access for credentials;
  leave concrete storage technologies and command syntax to later design.
- Bind credentials to their service and identity. Local removal and remote
  revocation are distinct needs. Do not invent authentication capabilities.

Environment readiness and parameter validation are not automatically Config
management. Require useful recovery guidance without manufacturing setup tasks.

For each confirmed auxiliary scenario, state the goal and completion criterion,
then apply the same parameter and resource analysis. Keep this bounded: do not
recursively generate auxiliary scenarios without demonstrated user value.

## Requirements synthesis

When all five steps have explicit approval, synthesize the confirmed record,
using the user's language and these sections in order:

1. **Users and boundaries**: roles, responsibilities, context, and non-goals.
2. **Primary scenario inventory**: role-to-scenario relationships, goals,
   completion criteria, and external participation stages.
3. **Per-scenario parameters**: one model per scenario using the Y/N table and
   three default classes; separate purpose-changing modes and fixed constraints.
4. **Per-scenario supporting resources**: ownership, lifetime, and management needs.
5. **Consolidated auxiliary scenarios by role**: shared Config, Credential, and
   resource management needs, with traceability and parameter analysis.

Keep unresolved items and conditional scope explicitly marked in their relevant
sections. Do not confuse observed implementation with proposed or confirmed
requirements. Include important failure and safety constraints without inventing
command syntax, storage architecture, exact default numbers, or implementation
plans into the confirmed requirements. Propose concrete interface decisions
separately in the Spec phase.

Keep this synthesis in the working record; a separate Markdown deliverable is
not required. Automatically continue to the HTML Spec rather than stopping at
a modeling summary.

## CLI Spec design and discussion

### Generate the draft

Read [the HTML template](assets/cli-spec.template.html) and the `cli-design`
skill. Translate confirmed scenarios into a complete proposed interface, not
an implementation plan. Generate a standalone HTML file using the template's
structure and inline styles. Use the user's language for its content and set
the HTML language accordingly.

Use a navigation-and-detail layout: a persistent command tree on the left and
the selected chapter on the right, with shared contracts as the initial detail.
Navigation links must support direct anchors and browser back/forward. Keep
the navigation above the detail on narrow screens, and expand all chapters
for printing. Preserve the template's no-JavaScript navigation and readable
all-sections fallback for browsers without the required CSS support.

Use an authorized destination if available; otherwise save the draft in the
session's persistent files area and provide a clickable link. This must not
block the automatic transition to design. Ask before copying it into the
repository or integrating it into an Idea. If persistent storage is unavailable,
ask for a destination instead of claiming the file was saved.

The Spec must begin with the command tree, followed by one chapter for every
independently invocable command node. A parent or root that has its own callable
behavior also needs a chapter; a grouping-only node does not need a duplicate
chapter, but its no-argument/help behavior must still be stated. Link callable
tree nodes to chapters with stable anchors. Preserve the hierarchy in the tree.
Do not invent commands simply to mirror internal functions or every resource.

Each command chapter includes:

- Full command path, purpose, related scenario IDs, synopsis, and approval state.
- Parameters: positional arguments, flags, and any stdin contract; names, types,
  requiredness, defaults, user configuration mapping, constraints, and conflicts.
  Link shared options instead of duplicating inconsistent definitions.
- Expected output: stdout shape and field meanings, stderr diagnostics and
  progress, exit codes, and any generated files or resource effects.
- Applicable help/no-argument, TTY/non-TTY, prompt, cancellation, and safety
  behavior. Mark unsupported modes explicitly rather than inventing them.
- Representative expected input/output examples where useful. Label invocation,
  stdin (if used), stdout, stderr, and exit status separately. Include success
  and a meaningful failure for commands with failure cases. Examples are
  proposed contracts, not evidence that the CLI has been implemented or tested.

Put genuinely shared contracts after the command tree and before the chapters;
each chapter must link to the applicable rules and state its exceptions. Keep
unresolved decisions explicit. Do not silently convert an agreed existence of a
default into an approved numeric value. Trace interface choices to requirements;
new requirements reopen the relevant modeling decision.

The bundled template is a reusable layout, not a Task Engine command proposal.
Replace all placeholder tokens, repeat the chapter block for actual commands,
and remove inapplicable rows. Escape inserted text and code as HTML; never insert
untrusted raw HTML or secrets. Keep the document offline-readable, without
external fonts, scripts, or dependencies. Do not require JavaScript for navigation.

### Discuss the saved Spec

Generate the whole draft first, then discuss the document rather than pasting
it all into chat. Present a short summary and a link to the command tree; seek
approval of that structure first. Next, discuss one command chapter at a time
in tree order, including relevant shared contracts. Use the same single
predefined `同意` choice with freeform feedback and automatic advancement.

Save revisions before requesting confirmation and link to the affected anchor.
Track tree and chapter approvals separately from modeling approvals; approving
requirements does not approve their proposed CLI mapping. Name the scope of
each confirmation. Mark changed approved sections reopened, and revisit affected
examples or shared contracts. Keep unrelated approvals intact.

After all sections and shared contracts are approved, check cross-command
consistency and finalize the HTML Spec. Unresolved design decisions prevent
finalization unless explicitly deferred by the user. Provide the final file link
and a concise summary; do not automatically implement the design.

### Validate the document

- Every callable tree node has exactly one matching chapter and valid anchor.
- Parameters, synopsis, examples, output shapes, and exit codes agree.
- HTML has a meaningful title and language, ordered headings, table headers,
  visible keyboard focus, and readable narrow-screen and print layouts.
- All placeholder tokens are replaced; IDs are unique and internal links resolve.
- No external assets, secret values, or executable sample commands run on load.
- Inspect the rendered document when browser tools are available. Structural
  validation alone must not be reported as visual verification.

## Completion checklist

- Users and scenarios were discovered before command design.
- Multiple primary scenarios are allowed; each individual model has one clear goal.
- Existing answers were reused, conclusions recorded incrementally, and revisions
  propagated to affected decisions.
- Each step began with an agent proposal, incorporated user feedback, and received
  explicit user approval before advancing; edit requests were not treated as OK.
- Proposals and revisions remain readable in ordinary conversation, not buried
  inside question forms; any host-required confirmation is brief.
- Every ordinary parameter uses N/N, N/Y, or Y/Y, with literal Y/N cells.
- Full execution context was considered without duplicating one business identity.
- Config and Credential are distinguished without choosing implementation details.
- Supporting resources include applicable services, not only files and databases.
- Consolidation preserves scope, ownership, and links to the primary scenarios.
- Unconfirmed needs remain open rather than becoming fabricated requirements.
- Modeling completion automatically produced a saved HTML Spec draft.
- The Spec starts with a linked command tree and covers every callable node in
  its own parameter/output chapter, with useful expected input/output examples.
- Tree, command chapters, and shared contracts were discussed and approved;
  final Spec status does not imply implementation or runtime verification.
- The final document follows the confirmed model and approved interface design.
