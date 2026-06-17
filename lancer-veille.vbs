Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d ""C:\Users\sandr\Dev\Perso\Projets\Veille-techno\widget\veille-widget"" && npm run electron", 0, False
