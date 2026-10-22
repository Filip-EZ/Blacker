@echo off
rem Zadanie Harmonogramu zadan Windows (co godzine). Zbiera sklepy z localOnly: true
rem w config/sources.yaml, ktore blokuja serwery GitHub Actions, ale wpuszczaja domowe IP.
rem Ocene AI robi przebieg na GitHubie, wiec tu jej nie odpalamy.
cd /d "%~dp0.."
if not exist logs mkdir logs
echo ==== %date% %time% >> logs\scrape-local.log
call "%APPDATA%\npm\pnpm.cmd" scrape --source=komputronik,xkom-hotshot --no-ai >> logs\scrape-local.log 2>&1
