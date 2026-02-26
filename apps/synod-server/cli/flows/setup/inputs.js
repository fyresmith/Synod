import prompts from 'prompts';

export async function collectSetupInputs({ yes, envValues }) {
  let vaultName = '';
  let vaultParentPath = '';
  let ownerEmail = '';
  let ownerDisplayName = '';
  let ownerPassword = '';

  if (!yes) {
    const nameResp = await prompts({
      type: 'text',
      name: 'name',
      message: 'Vault display name (e.g. "Team Vault")',
      validate: (v) => String(v).trim().length > 0 || 'Vault name is required',
    });
    vaultName = String(nameResp.name ?? '').trim();

    if (!String(envValues.VAULT_PATH ?? '').trim()) {
      const parentResp = await prompts({
        type: 'text',
        name: 'path',
        message: 'Choose folder location for the generated vault (parent directory)',
        validate: (v) => String(v).trim().length > 0 || 'Parent folder path is required',
      });
      vaultParentPath = String(parentResp.path ?? '').trim();
    }

    const acctResp = await prompts([
      { type: 'text', name: 'email', message: 'Owner email (for dashboard login)' },
      { type: 'text', name: 'displayName', message: 'Owner display name' },
      { type: 'password', name: 'password', message: 'Owner password' },
    ]);
    ownerEmail = String(acctResp.email ?? '').trim();
    ownerDisplayName = String(acctResp.displayName ?? '').trim() || 'Owner';
    ownerPassword = String(acctResp.password ?? '');
  }

  return {
    vaultName,
    vaultParentPath,
    ownerEmail,
    ownerDisplayName,
    ownerPassword,
  };
}
