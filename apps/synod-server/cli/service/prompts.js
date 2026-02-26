import prompts from 'prompts';

export async function shouldProceed({ message, yes }) {
  if (yes) return true;
  const answer = await prompts({
    type: 'confirm',
    name: 'ok',
    message,
    initial: true,
  });
  return Boolean(answer.ok);
}
