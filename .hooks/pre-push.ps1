# PowerShell pre-push hook for Windows
# This script runs lint checks before allowing a push to proceed

Write-Host "Running lint checks before pushing..." -ForegroundColor Cyan

# Run the npm lint script
$process = Start-Process -FilePath "npm" -ArgumentList "run", "lint" -NoNewWindow -Wait -PassThru

# Check the exit code
if ($process.ExitCode -ne 0) {
    Write-Host "Error: Lint check failed. Your push has been cancelled." -ForegroundColor Red
    Write-Host "Please run 'npm run lint:fix' to fix the issues and try again." -ForegroundColor Yellow
    exit 1
}

# If we got here, linting passed
Write-Host "Lint check passed. Proceeding with push..." -ForegroundColor Green
exit 0

