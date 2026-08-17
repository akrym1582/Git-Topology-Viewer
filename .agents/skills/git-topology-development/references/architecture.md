# Architecture reference

## Dependency boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Git | Executable resolution, safe process invocation, Git output parsing | DAG presentation, VS Code API |
| Domain | Commit/ref models, relation projection, layout | Processes, React, VS Code API |
| VS Code | Commands, panels, virtual documents, diff editor, webview mediation | Graph semantics, UI rendering |
| Webview | Controls, SVG rendering, selection and comparison presentation | Git execution, repository filesystem access |

The data flow is `Git CLI -> Git layer -> CommitGraph -> RefViewGraph -> Webview`.
User actions travel back as messages and are handled by the extension host.

## Graph semantics

- A `GitRef` points to a commit. The relation view groups visible refs by their
  target commit without claiming that a ref is a DAG vertex.
- `CommitGraph.nodes` and `CommitGraph.order` describe the source DAG.
- The relation view contains only visible ref groups. Its edges connect a ref
  group to the nearest older visible ref groups reachable through the DAG.
- A merge can produce multiple relation edges. Those edges describe reachability,
  never an inferred branch-parent hierarchy.
- Intermediate commits remain in the immutable source DAG and are never rendered
  or expanded in the relation view.

## Comparison direction

For selected `left` compared against base `right`:

- Changes since divergence: `git diff right...left`
- Current snapshots: `git diff right left` (or equivalent `right..left` diff syntax)
- Only in left: `git rev-list right..left`
- Only in right: `git rev-list left..right`
- Merge bases: `git merge-base --all left right`

Preserve both sides of renames and handle a missing path on additions/deletions in
the virtual document provider instead of checking out either ref.

## Message boundary

Requests should be discriminated unions with validated fields. Responses should
contain plain serializable objects—never `Map`, `Set`, VS Code objects, or class
instances. The panel owns Git services and sends rendered-model data; the webview
only sends intent such as changing ref visibility, comparing refs, or opening a
diff.

## Performance guardrails

- Bound initial revision walking with the configured maximum.
- Avoid commit message, author, patch, and changed-file reads on initial load.
- Cache against repository state only when invalidation accounts for HEAD and refs.
- Prefer incremental/local view changes, but never let a cache become a second
  source of repository truth.
