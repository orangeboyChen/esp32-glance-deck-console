import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import sharp from 'sharp'

const output_directory = resolve(import.meta.dirname, '../../docs/image2')
const width = 1600
const height = 1024

const escape_xml = (value) => value.replace(/[<>&"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
const text = (value, x, y, size = 20, weight = 400, color = '#1d1d1f', anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escape_xml(value)}</text>`
const rect = (x, y, box_width, box_height, fill = '#ffffff', stroke = '#d2d2d7', radius = 16) => `<rect x="${x}" y="${y}" width="${box_width}" height="${box_height}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`
const rule = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d2d2d7"/>`
const button = (label, x, y, box_width, primary = false) => `${rect(x, y, box_width, 42, primary ? '#0b7a5c' : '#ffffff', primary ? '#0b7a5c' : '#c7c7cc', 11)}${text(label, x + box_width / 2, y + 28, 16, 600, primary ? '#ffffff' : '#1d1d1f', 'middle')}`
const badge = (label, x, y, color = '#e8f5e9') => `${rect(x, y, 96, 30, color, color, 15)}${text(label, x + 48, y + 21, 13, 700, '#1d1d1f', 'middle')}`
const input = (label, x, y, box_width, value = '') => `${text(label, x, y - 10, 14, 600, '#3a3a3c')}${rect(x, y, box_width, 44, '#ffffff', '#c7c7cc', 9)}${value ? text(value, x + 14, y + 29, 16, 400, '#6e6e73') : ''}`
const section_heading = (label, x, y, detail = '') => `${text(label, x, y, 25, 700)}${detail ? text(detail, x, y + 25, 15, 400, '#6e6e73') : ''}`
const icon_choice = (label, x, y, selected = false) => `${rect(x, y, 52, 42, selected ? '#007aff' : '#ffffff', selected ? '#007aff' : '#c7c7cc', 11)}${text(label, x + 26, y + 28, 14, 700, selected ? '#ffffff' : '#1d1d1f', 'middle')}`

function frame(title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f2f5f3"/>
    <rect width="224" height="${height}" fill="#ffffff" stroke="#d4dfd9"/>
    ${rect(28, 24, 40, 40, '#0b7a5c', '#0b7a5c', 10)}${text('▧', 48, 52, 18, 700, '#ffffff', 'middle')}
    ${['Devices', 'Sources', 'Displays', 'Alerts', 'Firmware', 'Settings'].map((item, index) => button(item, 24, 112 + index * 56, 176, index === 0)).join('')}
    <rect x="224" width="${width - 224}" height="64" fill="#f7faf8" stroke="#d4dfd9"/>
    ${text('GLANCE DECK / CONTROL PLANE', 272, 40, 15, 700, '#0b7a5c')}
    ${button('EN  中文  日本語', 1386, 12, 174)}
    ${text(title, 272, 124, 38, 700)}
    ${text(subtitle, 272, 156, 18, 400, '#60706a')}
    ${rule(272, 188, 1560, 188)}
    <g transform="translate(184 0)">${body}</g>
  </svg>`
}

function dashboard() {
  const summaries = ['2\nRegistered devices', '1\nActive alerts', '24\nSource updates today']
  const summary = summaries.map((item, index) => {
    const [count, label] = item.split('\n')
    const x = 88 + index * 416
    return `${rect(x, 238, 388, 118, '#fbfbfd')}${text(count, x + 28, 290, 34, 700)}${text(label, x + 28, 324, 16, 400, '#6e6e73')}`
  }).join('')
  return frame('Devices at a glance', 'A device-accurate view of displays, alerts, and Home Assistant automation.', `
    ${button('Sources', 88, 206, 100)}${button('Firmware', 200, 206, 112)}${button('Displays', 324, 206, 108)}${button('Alerts', 444, 206, 92)}${button('Settings', 548, 206, 104)}${button('+ Add device', 1130, 206, 206, true)}
    ${summary.replaceAll('238', '274').replaceAll('290', '326').replaceAll('324', '360')}
    ${section_heading('Devices', 88, 450, 'Select a device to inspect its last confirmed page.')}
    ${button('All devices', 1112, 426, 112, true)}${button('Needs attention', 1236, 426, 128)}
    ${rect(88, 496, 1248, 276, '#ffffff')}
    ${rect(114, 522, 332, 224, '#f2f4ed', '#1d1d1f', 8)}
    ${text('400 × 300 device preview', 280, 640, 17, 600, '#26322a', 'middle')}
    ${badge('ONLINE', 478, 528)}${text('usage', 594, 549, 15, 600, '#6e6e73')}${text('Kitchen display', 478, 600, 25, 700)}${text('Firmware 0.1.0 · Battery 84%', 478, 630, 16, 400, '#6e6e73')}
    ${text('Token balance', 478, 678, 16, 600)}${rect(478, 692, 520, 10, '#e5e5ea', '#e5e5ea', 5)}<rect x="478" y="692" width="312" height="10" rx="5" fill="#007aff"/>
    ${button('Open device', 1036, 688, 140, true)}${button('Refresh', 1188, 688, 112)}
    ${section_heading('Display pages', 88, 830, 'Shown after selecting a device.')}
    ${rect(88, 866, 1248, 118, '#ffffff')}${badge('Confirmed: usage', 118, 894, '#e8f5e9')}${badge('Target: usage', 228, 894, '#e8f5e9')}${text('3 enabled pages', 118, 956, 16, 400, '#6e6e73')}${button('Show page', 1050, 894, 120)}${button('Save pages', 1182, 894, 124, true)}
  `)
}

function displays() {
  return frame('Display releases', 'Compose fixed 400 × 300 pages, inspect the device-accurate preview, and publish an immutable release.', `
    ${section_heading('Page editor', 88, 256)}${button('+ Add page', 570, 226, 132)}${section_heading('Device preview', 858, 256)}${button('Refresh preview', 1166, 226, 170)}
    ${rect(88, 286, 672, 560)}${button('page-1', 112, 312, 94, true)}${button('system', 218, 312, 88)}
    ${input('Page ID', 112, 392, 604, 'page-1')}${input('Title', 112, 476, 604, 'Usage')}${input('Subtitle', 112, 560, 604, 'Codex')}
    ${text('Icon', 112, 644, 14, 600, '#3a3a3c')}${button('None', 112, 656, 76)}${icon_choice('Usage', 200, 656, true)}${icon_choice('Home', 264, 656)}${icon_choice('Battery', 328, 656)}${icon_choice('Wi-Fi', 392, 656)}${icon_choice('System', 456, 656)}
    ${text('☐ Show usage progress', 112, 748, 16, 600)}${input('Lines JSON', 112, 782, 604, '[{ "label": "Day", "value": "19%" }]')}
    ${rect(810, 286, 526, 560, '#fbfbfd')}${text('▧', 1073, 506, 46, 400, '#6e6e73', 'middle')}${text('Preview is empty', 1073, 550, 20, 700, '#1d1d1f', 'middle')}${text('Refresh after entering a title.', 1073, 580, 16, 400, '#6e6e73', 'middle')}
    ${section_heading('Publish targets', 88, 900, 'Select devices, then open the publish confirmation.')}${rect(88, 940, 1248, 38, '#fbfbfd')}${text('☐ Kitchen display', 118, 966, 16, 600)}${button('Publish display', 1128, 936, 176, true)}
  `)
}

function sources() {
  return frame('Usage sources', 'Collect subscription and status data, then bind mapped values to display documents.', `
    ${section_heading('SoruxGPT Codex quota', 88, 246, 'Connect once; the control plane stores the token encrypted and refreshes the live quota.')}${rect(88, 274, 1248, 136, '#fbfbfd')}${input('SoruxGPT access token', 112, 320, 736, '••••••••••••')}${button('Connect SoruxGPT', 876, 320, 190, true)}${text('Most constrained active day, week, or month window drives the usage meter.', 112, 390, 15, 400, '#6e6e73')}
    ${section_heading('Saved sources', 88, 468)}${button('Refresh', 1204, 438, 132)}${rect(88, 496, 1248, 108, '#fbfbfd')}${text('SoruxGPT Codex', 116, 540, 22, 700)}${badge('ACTIVE', 324, 518)}${text('GET app.soruxgpt.com/api/v1/codex · refreshes every 900 seconds', 116, 576, 16, 400, '#6e6e73')}${button('Test request', 1166, 532, 140)}
    ${section_heading('Import a CC Switch export', 88, 660, 'Review request settings without executing extractor JavaScript.')}${rect(88, 694, 1248, 106, '#fbfbfd')}${text('Paste UsageScript JSON export…', 112, 738, 17, 400, '#8e8e93')}${button('Review import', 112, 752, 144)}
    ${section_heading('Create source', 88, 858, 'Secrets are encrypted after saving; additional fields continue below.')}${rect(88, 884, 760, 94, '#fbfbfd')}${input('Name', 112, 914, 336, 'New usage source')}${input('Base URL', 472, 914, 352, 'https://api.example.com')}
  `)
}

function alerts() {
  return frame('Alerts', 'Evaluate source values and send a clear alert page to selected devices.', `
    ${section_heading('Alert rules', 88, 258)}${button('Refresh', 1204, 228, 132)}${rect(88, 286, 1248, 132, '#fbfbfd')}${text('Low remaining balance', 116, 330, 22, 700)}${badge('ACTIVE', 368, 308, '#ffe5e5')}${badge('ENABLED', 476, 308)}${text('Codex usage · remaining · at most 20 · 1 device / usage', 116, 370, 16, 400, '#6e6e73')}${button('Delete', 1180, 338, 126)}
    ${section_heading('Create alert rule', 88, 484, 'Test-only rules never control a device.')}${rect(88, 510, 760, 466, '#fbfbfd')}
    ${input('Rule name', 112, 556, 336, 'Low usage')}${input('Source', 472, 556, 352, 'Codex usage')}
    ${input('Field', 112, 640, 336, 'used')}${input('Threshold', 472, 640, 352, '80')}
    ${text('Condition', 112, 728, 14, 600, '#3a3a3c')}${button('at least', 112, 740, 120, true)}${button('at most', 244, 740, 112)}${button('equals', 368, 740, 98)}
    ${text('Target devices', 112, 826, 14, 600, '#3a3a3c')}${rect(112, 840, 712, 64, '#ffffff')}${text('☐ Kitchen display', 136, 880, 16, 600)}
    ${text('Severity, message, page IDs, and test-only continue below.', 112, 944, 15, 400, '#6e6e73')}
  `)
}

function firmware() {
  return frame('Firmware releases', 'Install a verified release only on compatible devices.', `
    ${section_heading('Verified releases', 88, 258)}${button('Refresh', 1204, 228, 132)}${rect(88, 286, 1248, 282, '#fbfbfd')}${text('v0.1.0', 116, 336, 26, 700)}${text('ESP32-S3-RLCD-4.2', 116, 368, 16, 400, '#6e6e73')}${badge('STABLE', 320, 314)}${text('Verified Aug 13 · View manifest', 116, 408, 16, 400, '#6e6e73')}${rule(116, 438, 1308, 438)}${text('Kitchen display', 116, 486, 18, 600)}${text('Current: 0.1.0 · Update: healthy', 116, 516, 16, 400, '#6e6e73')}${button('Start update', 1044, 474, 140, true)}${button('Roll back', 1196, 474, 110)}
    ${section_heading('Staged rollout', 88, 644, 'Queue a signed release for a percentage of power-safe compatible devices.')}${rect(88, 674, 650, 302, '#fbfbfd')}
    ${input('Release', 112, 716, 602, 'v0.1.0 · stable')}${input('Percentage', 112, 790, 602, '25')}${text('Candidate devices', 112, 870, 14, 600, '#3a3a3c')}${rect(112, 884, 602, 42, '#ffffff')}${text('☐ Kitchen display', 136, 912, 16, 600)}${button('Start rollout', 112, 930, 180, true)}
  `)
}

function settings() {
  return frame('Account and access', 'Manage the scoped credentials Home Assistant uses to reach the control-plane API.', `
    ${section_heading('Home Assistant API tokens', 88, 258, 'Secrets are shown only once after creation.')}${rect(88, 286, 1248, 370, '#fbfbfd')}${input('Token label', 116, 334, 650, 'Home Assistant')}${text('Choose scopes', 116, 426, 14, 600, '#3a3a3c')}${text('☑ Read devices     ☑ Control devices', 116, 464, 17, 600)}${text('☑ Read alerts       ☐ Install firmware', 116, 498, 17, 600)}${button('Create token', 116, 520, 150, true)}${rule(116, 584, 1308, 584)}${text('Existing tokens', 116, 620, 18, 700)}${text('Home Assistant · Read devices · Control devices', 116, 646, 17, 400, '#6e6e73')}${button('Revoke', 1168, 612, 128)}
    ${section_heading('Passkeys', 88, 748, 'Use a device biometric or security key instead of a password.')}${rect(88, 778, 1248, 150, '#fbfbfd')}${text('1 passkey registered', 116, 832, 20, 700)}${text('Passkey · Created Aug 13', 116, 874, 17, 400, '#6e6e73')}${button('Add passkey', 1052, 806, 154, true)}${button('Remove', 1218, 806, 88)}
  `)
}

function auth() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f5f5f7"/>
    ${rect(450, 168, 540, 688, '#ffffff', '#d2d2d7', 24)}
    ${text('GLANCE DECK', 498, 242, 16, 700, '#007aff')}${text('Sign in to Glance Deck', 498, 302, 34, 700)}${text('Use the administrator account or a registered passkey.', 498, 336, 17, 400, '#6e6e73')}
    ${input('Email', 498, 400, 444, 'admin@example.com')}${input('Password', 498, 500, 444, '••••••••••••')}${button('Sign in', 498, 574, 444, true)}${button('Sign in with passkey', 498, 634, 444)}${text('First run?', 498, 714, 15, 400, '#6e6e73')}
  </svg>`
}

await mkdir(output_directory, { recursive: true })
for (const [name, svg] of Object.entries({ dashboard: dashboard(), displays: displays(), sources: sources(), alerts: alerts(), firmware: firmware(), settings: settings(), auth: auth() })) {
  await writeFile(resolve(output_directory, `${name}.png`), await sharp(Buffer.from(svg)).png().toBuffer())
}
