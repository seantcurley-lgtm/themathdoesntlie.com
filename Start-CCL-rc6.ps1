$ErrorActionPreference = 'Stop'
$candidateRoot = $PSScriptRoot
& node (Join-Path $candidateRoot 'tools/start-ccl-preview.mjs') --expected-build CCL-FOS-20261106.6
if ($LASTEXITCODE -ne 0) { throw 'CCL rc.6 preview did not verify successfully.' }
