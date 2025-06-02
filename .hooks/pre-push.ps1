# PowerShell pre-push hook for Windows
# This script runs lint checks before allowing a push to proceed

Write-Host "Running lint checks before pushing..." -ForegroundColor Cyan

# Get the git repository root directory
$gitRootDir = git rev-parse --show-toplevel 2>$null
if (-not $gitRootDir) {
    # Fallback to current script location if git command fails
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $gitRootDir = Split-Path -Parent (Split-Path -Parent $scriptDir)
}

Write-Host "Using repository root: $gitRootDir" -ForegroundColor Gray

# Change to the repository root directory
try {
    Push-Location $gitRootDir
    
    # On Windows, we need to use npm.cmd not npm
    $npmCmd = "npm.cmd"
    
    Write-Host "Running: $npmCmd run lint" -ForegroundColor Gray
    
    # Try to run the lint script
    try {
        # Use Invoke-Expression instead of Start-Process for better error handling
        $output = & $npmCmd run lint 2>&1
        $exitCode = $LASTEXITCODE
        
        # Display the output
        $output | ForEach-Object { Write-Host $_ }
        
        # Check the exit code
        if ($exitCode -ne 0) {
            Write-Host "Error: Lint check failed with exit code $exitCode. Your push has been cancelled." -ForegroundColor Red
            Write-Host "Please run 'npm run lint:fix' to fix the issues and try again." -ForegroundColor Yellow
            exit 1
        }
        
        # If we got here, linting passed
        Write-Host "Lint check passed. Proceeding with push..." -ForegroundColor Green
        exit 0
    }
    catch {
        Write-Host "Error executing npm command: $_" -ForegroundColor Red
        Write-Host "Push cancelled. Please ensure npm is installed and try again." -ForegroundColor Yellow
        exit 1
    }
}
finally {
    # Restore the original directory
    Pop-Location
}

