import chalk from 'chalk';

const VIOLET = '#7c3aed';
const GREEN  = '#16a34a';
const AMBER  = '#d97706';
const RED    = '#dc2626';

export function section(title) {
  console.log(`\n${chalk.bold.hex(VIOLET)(title)}`);
}

export function info(msg) {
  console.log(chalk.hex(VIOLET)(`→ ${msg}`));
}

export function success(msg) {
  console.log(chalk.hex(GREEN)(`✓ ${msg}`));
}

export function warn(msg) {
  console.log(chalk.hex(AMBER)(`! ${msg}`));
}

export function fail(msg) {
  console.error(chalk.hex(RED)(`✗ ${msg}`));
}

/** Colored status dot: 'running'|'ok' → green, 'pending'|'warning' → amber, any other → red */
export function statusDot(status) {
  if (status === 'running' || status === 'ok') return chalk.hex(GREEN)('●');
  if (status === 'pending' || status === 'warning') return chalk.hex(AMBER)('●');
  return chalk.hex(RED)('●');
}

/**
 * Print a single key-value line with optional status dot prefix.
 * @param {string} label
 * @param {string} value
 * @param {{ labelWidth?: number, status?: string }} opts
 */
export function kv(label, value, opts = {}) {
  const { labelWidth = 16, status } = opts;
  const dot = status ? statusDot(status) + ' ' : '';
  const paddedLabel = chalk.gray(label.padEnd(labelWidth));
  console.log(`  ${paddedLabel} ${dot}${value}`);
}

/**
 * Print a horizontal divider, optionally labelled.
 * @param {string} [label]
 */
export function divider(label) {
  const width = 48;
  if (label) {
    const side = Math.max(0, Math.floor((width - label.length - 2) / 2));
    const line = '─'.repeat(side) + ' ' + chalk.gray(label) + ' ' + '─'.repeat(side);
    console.log('  ' + chalk.gray(line));
  } else {
    console.log('  ' + chalk.gray('─'.repeat(width)));
  }
}

/**
 * Print a boxed panel.
 * @param {string} title
 * @param {() => void} renderFn - callback that prints content lines using kv/divider/console.log
 */
export function box(title, renderFn) {
  const width = 52;
  const titleStr = ` ${title} `;
  const remaining = Math.max(0, width - titleStr.length - 2);
  const rightDashes = '─'.repeat(remaining);

  console.log('');
  console.log(chalk.hex(VIOLET)(`┌─${titleStr}${'─'.repeat(Math.min(remaining, width - titleStr.length - 1))}┐`));

  // Capture output from renderFn by temporarily replacing console.log/error
  const lines = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args) => lines.push({ stream: 'log', text: args.join(' ') });
  console.error = (...args) => lines.push({ stream: 'err', text: args.join(' ') });

  try {
    renderFn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }

  for (const { stream, text } of lines) {
    if (stream === 'err') {
      origErr(text);
    } else {
      origLog(text);
    }
  }

  console.log(chalk.hex(VIOLET)(`└${'─'.repeat(width + 1)}┘`));
  console.log('');
}

/**
 * Print an aligned table inside a box.
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {{ title?: string }} opts
 */
export function table(headers, rows, opts = {}) {
  const { title = '' } = opts;
  if (rows.length === 0) {
    box(title || 'Table', () => { console.log('  (none)'); });
    return;
  }

  // Compute column widths
  const colWidths = headers.map((h, i) => {
    const maxVal = rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), 0);
    return Math.max(h.length, maxVal);
  });

  const headerRow = headers.map((h, i) => chalk.bold(h.padEnd(colWidths[i]))).join('  ');
  const separator = colWidths.map((w) => '─'.repeat(w)).join('  ');

  const boxTitle = title || (headers[0] ?? 'Table');
  const width = Math.max(52, separator.length + 4);
  const titleStr = ` ${boxTitle} `;
  const dashCount = Math.max(0, width - titleStr.length - 1);

  console.log('');
  console.log(chalk.hex(VIOLET)(`┌─${titleStr}${'─'.repeat(dashCount)}┐`));
  console.log(`  ${headerRow}`);
  console.log('  ' + chalk.gray(separator));

  for (const row of rows) {
    const line = row.map((cell, i) => (cell ?? '').padEnd(colWidths[i])).join('  ');
    console.log(`  ${line}`);
  }

  console.log(chalk.hex(VIOLET)(`└${'─'.repeat(width + 1)}┘`));
  console.log('');
}
