' Dua Video Studio - hidden auto-start launcher
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "H:\DuaVideoGenerator\remotion\dashboard"
WshShell.Run "node server.js", 0, False
