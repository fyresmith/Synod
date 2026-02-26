import { SYNOD_HOME } from '../constants.js';

function xmlEscape(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildLaunchdPlist({
  serviceName,
  nodePath,
  synodBinPath,
  envFile,
  stdoutPath,
  stderrPath,
}) {
  const args = [nodePath, synodBinPath, 'run', '--env-file', envFile, '--quiet']
    .map((arg) => `    <string>${xmlEscape(arg)}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"> 
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(serviceName)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(SYNOD_HOME)}</string>
  <key>StandardOutPath</key>
  <string>${xmlEscape(stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(stderrPath)}</string>
</dict>
</plist>
`;
}

export function buildSystemdUnit({
  serviceName,
  nodePath,
  synodBinPath,
  envFile,
  user,
}) {
  const execStart = `${nodePath} ${synodBinPath} run --env-file ${envFile} --quiet`;
  return `[Unit]
Description=Synod Collaborative Vault Server
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${SYNOD_HOME}
ExecStart=${execStart}
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${serviceName}

[Install]
WantedBy=multi-user.target
`;
}
