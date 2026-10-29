param([string]$Container = 'teamfight-evolution-trellis-router-1')
$ErrorActionPreference = 'Stop'
Write-Host 'Sign in to Google in your browser using the URL printed below.'
Write-Host 'Paste the one-time Google code into THIS terminal, never into chat.'
Write-Host 'This lists existing sessions; it does not allocate a new or paid runtime.'
& docker exec -it $Container colab sessions
if ($LASTEXITCODE -ne 0) { throw 'Colab sign-in did not complete. Retry this script.' }
& docker exec $Container python /app/connect_existing_colab.py
if ($LASTEXITCODE -ne 0) { throw 'Login succeeded; review which existing T4 runtime to connect.' }
Write-Host 'Colab authentication is saved locally. Tell the assistant that sign-in is complete.'
