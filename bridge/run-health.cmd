@echo off
rem Run by Task Scheduler: Google Health into the ledger. See bridge\README.md.
set GHEALTH_BIN=%USERPROFILE%\bin\ghealth.exe
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0.."
echo === %date% %time% >> bridge\last-run.log
call npm run health >> bridge\last-run.log 2>&1
