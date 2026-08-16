# Architecture reference

## Dependency boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Git | Executable resolution, safe process invocation, Git output parsing | DAG presentation, VS Code API |
| Domain | Commit/ref models, significance, compression, layout, relations | Processes, React, VS Code API |
| VS Code | Commands, panels, virtual documents, diff editor, webview mediation | Graph semantics, UI rendering |
| Webview | Controls, SVG rendering, selection and comparison presentation | Git execution, repository filesystem access |

The data flow is `Git CLI -> Git layer -> CommitGraph -> ViewGraph -> Webview`.
User actions travel back as messages and are handled by the extension host.

## Graph semantics

- A `GitRef` points to a commit. It is never an independent graph vertex.
- `CommitGraph.nodes` and `CommitGraph.order` describe the source DAG.
- A view mode selects visible commits; it does not add/remove source DAG commits.
- A branch point is a commit with multiple known children. A merge has multiple
  parents. Root and truncation boundaries remain visible when required for edges.
- A collapsed range describes a linear path between visible commits. Expansion
  changes visibility for that range only.

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
only sends intent such as changing mode, expanding a range, comparing refs, or
opening a diff.

## Performance guardrails

- Bound initial revision walking with the configured maximum.
- Avoid commit message, author, patch, and changed-file reads on initial load.
- Cache against repository state only when invalidation accounts for HEAD and refs.
- Prefer incremental/local view changes, but never let a cache become a second
  source of repository truth.
