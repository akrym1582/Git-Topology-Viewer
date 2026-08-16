[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw 'Unable to determine the repository root.'
}

Set-Location -LiteralPath $repoRoot

function Assert-LastExitCode {
  param(
    [Parameter(Mandatory)]
    [string]$Name
  )

  if ($LASTEXITCODE -ne 0) {
    throw "Validation step failed: $Name"
  }
}

npm.cmd run typecheck
Assert-LastExitCode 'TypeScript typecheck'

npm.cmd test
Assert-LastExitCode 'Unit tests'

npm.cmd run build
Assert-LastExitCode 'Production build'

git diff --check
Assert-LastExitCode 'Git diff check'
