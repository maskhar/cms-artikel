export function normalizeCmsHostname(value: string) {
  return value.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function isValidCmsHostname(value: string) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalizeCmsHostname(value));
}
