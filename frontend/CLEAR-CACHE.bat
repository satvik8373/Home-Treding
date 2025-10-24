@echo off
echo Clearing frontend cache...
rmdir /s /q node_modules\.cache 2>nul
echo Cache cleared!
echo.
echo Now run: npm start
pause
