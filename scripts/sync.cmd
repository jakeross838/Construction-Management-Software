@echo off
REM Ross Built CMS - Sync Script
REM Run this when switching between computers

echo.
echo ========================================
echo   Ross Built CMS - Sync
echo ========================================
echo.

cd /d "%~dp0\.."

REM Check for uncommitted changes
echo [1/5] Checking for local changes...
git status --porcelain > nul 2>&1
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%i
if %CHANGES% GTR 0 (
    echo.
    echo WARNING: You have uncommitted local changes!
    echo.
    git status --short
    echo.
    set /p CONTINUE="Continue anyway? (y/n): "
    if /i not "%CONTINUE%"=="y" exit /b 1
)

REM Fetch and show status
echo.
echo [2/5] Fetching from GitHub...
git fetch origin

REM Check if we're behind
for /f %%i in ('git rev-list HEAD..origin/main --count') do set BEHIND=%%i
if %BEHIND% GTR 0 (
    echo      %BEHIND% new commit(s) available
) else (
    echo      Already up to date
)

REM Pull changes
echo.
echo [3/5] Pulling latest changes...
git pull origin main
if errorlevel 1 (
    echo.
    echo ERROR: Git pull failed. Resolve conflicts manually.
    exit /b 1
)

REM Check if package.json changed and install deps
echo.
echo [4/5] Checking dependencies...
git diff HEAD@{1} --name-only 2>nul | findstr /i "package.json" > nul
if %errorlevel%==0 (
    echo      Dependencies changed - running npm install...
    call npm install
    cd client && call npm install && cd ..
) else (
    echo      No dependency changes
)

REM Done
echo.
echo [5/5] Sync complete!
echo.
echo ----------------------------------------
echo Ready to work. Start server with:
echo   npm start
echo ----------------------------------------
echo.
