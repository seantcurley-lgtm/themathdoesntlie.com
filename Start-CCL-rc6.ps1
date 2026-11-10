$ErrorActionPreference = 'Stop'
$candidateRoot = $PSScriptRoot
& node (Join-Path $candidateRoot 'tools/start-ccl-preview.mjs') --expected-build CCL-20261110.1
if ($LASTEXITCODE -ne 0) { throw 'CCL rc.6 preview did not verify successfully.' }
