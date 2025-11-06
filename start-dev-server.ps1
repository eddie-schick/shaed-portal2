Write-Host "Starting Ford Marketplace Development Server..."
Write-Host "Server will be available at http://localhost:5173/"
Write-Host "Press Ctrl+C to stop the server"
Write-Host ""

Set-Location $PSScriptRoot
npm run dev
