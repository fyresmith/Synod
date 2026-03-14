declare const __SYNOD_DEV__: boolean;

const YJS_IMPORT_IDENTIFIER = '__$YJS$__';

export function resetYjsImportFlagForDevReload(): void {
  if (!__SYNOD_DEV__) return;

  const scope = globalThis as Record<string, unknown>;
  if (scope[YJS_IMPORT_IDENTIFIER] === true) {
    delete scope[YJS_IMPORT_IDENTIFIER];
  }
}
