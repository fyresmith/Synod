import chalk from 'chalk';

export function section(title) {
  console.log(`\n${chalk.bold.cyan(title)}`);
}

export function info(msg) {
  console.log(chalk.cyan(`→ ${msg}`));
}

export function success(msg) {
  console.log(chalk.green(`✓ ${msg}`));
}

export function warn(msg) {
  console.log(chalk.yellow(`! ${msg}`));
}

export function fail(msg) {
  console.error(chalk.red(`✗ ${msg}`));
}
