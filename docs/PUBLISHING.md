# Publishing the extension

The extension is configured for the Visual Studio Marketplace publisher
`ymknr1582`.

## One-time Marketplace setup

1. Create or verify the publisher `ymknr1582` at the
   [Visual Studio Marketplace publisher management page](https://marketplace.visualstudio.com/manage).
2. Create an Azure DevOps personal access token with Marketplace **Manage** scope.
3. Add the token to the GitHub repository as the `VSCE_PAT` Actions secret.

The publisher ID in `package.json` must match the Marketplace publisher exactly.
The GitHub repository owner may be different from the Marketplace publisher ID.

## Validate and package locally

```powershell
npm ci
npm run typecheck
npm test
npm run package:check
npm run package
```

`package:check` lists the files that will be included. `package` builds the
extension and creates a `.vsix` file in the repository root. The PNG icon is
`resources/topology.png` and is referenced by `package.json`.

## Publish from GitHub Actions

Run **Actions → Publish VS Code extension** and select a semantic-version bump.
Leave **Publish the extension to the Visual Studio Marketplace** disabled for a
package-only release, or enable it after the `VSCE_PAT` secret and publisher are
ready. The workflow validates, builds, packages, commits the version bump, tags
the release, and creates a GitHub release.
