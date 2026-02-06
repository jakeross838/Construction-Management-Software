@echo off
REM Ross Built CMS - Push Script
REM Run this when done working to push changes

echo.
echo ========================================
echo   Ross Built CMS - Push Changes
echo ========================================
echo.

cd /d "%~dp0\.."

REM Check for changes
echo [1/3] Checking for changes...
git status --porcelain > nul 2>&1
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%i
if %CHANGES%==0 (
    echo      No changes to commit
    echo.

    REM Check if we need to push
    for /f %%i in ('git rev-list origin/main..HEAD --count') do set AHEAD=%%i
    if %AHEAD% GTR 0 (
        echo      %AHEAD% local commit(s) to push
        goto :dopush
    )
    echo      Nothing to push
    exit /b 0
)

REM Show changes
echo.
echo [2/3] Changes to commit:
git status --short
echo.

REM Get commit message
set /p MSG="Enter commit message (or 'skip' to push existing commits): "
if /i "%MSG%"=="skip" goto :dopush

REM Commit
echo.
git add .
git commit -m "%MSG%"
if errorlevel 1 (
    echo ERROR: Commit failed
    exit /b 1
)

:dopush
REM Push
echo.
echo [3/3] Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo ERROR: Push failed. Run 'scripts\sync' first to pull changes.
    exit /b 1
)

echo.
echo ----------------------------------------
echo Push complete! Safe to switch computers.
echo ----------------------------------------
echo.
