export function requiredText(form: FormData, key: string) {
  const value = form.get(key)?.toString().trim();
  if (!value) throw new Error(`${key} es requerido`);
  return value;
}

export function optionalText(form: FormData, key: string) {
  const value = form.get(key)?.toString().trim();
  return value ? value : undefined;
}

export function requiredInteger(form: FormData, key: string) {
  return Number.parseInt(requiredText(form, key), 10);
}

export function optionalInteger(form: FormData, key: string) {
  const value = optionalText(form, key);
  return value ? Number.parseInt(value, 10) : undefined;
}

export function optionalNumber(form: FormData, key: string) {
  const value = optionalText(form, key);
  return value ? Number(value) : undefined;
}

export function optionalDate(form: FormData, key: string) {
  const value = optionalText(form, key);
  return value ? new Date(value).toISOString() : undefined;
}
