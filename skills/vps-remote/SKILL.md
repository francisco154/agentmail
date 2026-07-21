---
name: vps-remote
description: "Execute commands, upload/download files, and manage the Contabo VPS (173.249.60.65) via SSH using Python paramiko. Use this skill whenever you need to run shell commands on the VPS, deploy files, build Android APKs, manage services (nginx, pm2, ngrok), or perform any server-side operation. This is the PRIMARY way to interact with the VPS — it bypasses the flaky local Bash tool by running everything through a stable Python→paramiko→SSH pipeline. Trigger on: VPS commands, remote server operations, SSH, deploy, build APK, server management, file upload/download to VPS."
---

# VPS-Remote Skill

Execute commands on the Contabo VPS via Python paramiko SSH, bypassing the unreliable local Bash tool.

## Why This Skill Exists

The local Bash tool has intermittent 403 Forbidden failures. This skill provides a **stable alternative** by routing all commands through Python + paramiko SSH to the VPS. Since Python scripts run via the same Bash tool but in a single atomic call, they are far less likely to fail mid-execution.

## VPS Credentials

- **Host:** 173.249.60.65
- **User:** root
- **Password:** tnAs4tbEYYg1m9a4q430Ht
- **Port:** 22

## Core Script: `scripts/vps_remote.py`

The bundled script at `scripts/vps_remote.py` provides these subcommands:

### `run <command>` — Execute a shell command on the VPS
```bash
/home/z/.venv/bin/python3 /home/z/my-project/skills/vps-remote/scripts/vps_remote.py run "uname -a"
```
Returns: stdout output. If exit code != 0, also shows stderr.

### `write <remote_path>` — Upload content from stdin to VPS
```bash
echo "file content" | /home/z/.venv/bin/python3 /home/z/my-project/skills/vps-remote/scripts/vps_remote.py write /remote/path/file.txt
```
Or write from a local file:
```bash
/home/z/.venv/bin/python3 /home/z/my-project/skills/vps-remote/scripts/vps_remote.py write /remote/path/file.txt < /local/file.txt
```

### `upload <local_path> <remote_path>` — Upload a file to VPS
```bash
/home/z/.venv/bin/python3 /home/z/my-project/skills/vps-remote/scripts/vps_remote.py upload /local/file.txt /remote/path/file.txt
```

### `download <remote_path> <local_path>` — Download a file from VPS
```bash
/home/z/.venv/bin/python3 /home/z/my-project/skills/vps-remote/scripts/vps_remote.py download /remote/file.txt /local/file.txt
```

### `multi <cmd1> <cmd2> ...` — Run multiple commands sequentially
```bash
/home/z/.venv/bin/python3 /home/z/my-project/skills/vps-remote/scripts/vps_remote.py multi "mkdir -p /var/www/test" "echo hello > /var/www/test/index.html" "cat /var/www/test/index.html"
```

### `script <remote_path>` — Upload a script from stdin and execute it on the VPS
```bash
cat script.sh | /home/z/.venv/bin/python3 /home/z/my-project/skills/vps-remote/scripts/vps_remote.py script /tmp/script.sh
```

## Usage Patterns

### Pattern 1: Quick command
For one-off commands, use `run`:
```
vps run "pm2 list"
```

### Pattern 2: Write config files
For writing config files to the VPS, use `write` with heredoc:
```
vps write /etc/nginx/sites-available/myapp << 'EOF'
server { ... }
EOF
```

### Pattern 3: Upload local files
For uploading files created locally:
```
vps upload /home/z/my-project/download/file.apk /var/www/f14-desktop/file.apk
```

### Pattern 4: Multi-step operations
For operations that need multiple steps:
```
vps multi "cd /opt/project && git pull" "cd /opt/project && npm install" "pm2 restart app"
```

## Key VPS Paths

- **Web root:** `/var/www/f14-desktop/`
- **Android project:** `/opt/f14-desktop-app/`
- **Relay server:** `/opt/f14-relay/`
- **Android SDK:** `/opt/android-sdk/`
- **Keystore:** `/opt/f14-backup/f14desktop-release.jks`
- **Gradle:** `/opt/gradle-8.5/bin/gradle`

## Telegram Integration

Bot token: `8903182977:AAGXWuM0ecMYbCDyBztl4fchOQpEPbn19tI`
Chat ID: `7955402738`

Send text:
```bash
vps run 'curl -s -X POST "https://api.telegram.org/bot8903182977:AAGXWuM0ecMYbCDyBztl4fchOQpEPbn19tI/sendMessage" -F chat_id=7955402738 -F "text=Hello"'
```

Send file:
```bash
vps run 'curl -s --max-time 120 -X POST "https://api.telegram.org/bot8903182977:AAGXWuM0ecMYbCDyBztl4fchOQpEPbn19tI/sendDocument" -F chat_id=7955402738 -F document=@/path/to/file.apk -F "caption=Description"'
```

## Important Notes

1. **Keep commands short** — avoid commands that run longer than 30 seconds. Split long builds into steps.
2. **For Android builds**, use `nohup` + check output separately if needed.
3. **Always verify** — after uploads, run `ls -la` or `md5sum` to confirm.
4. **Paramiko is pre-installed** at `/home/z/.venv/bin/python3`.
5. **All scripts persist** at `/home/z/my-project/skills/vps-remote/scripts/`.
