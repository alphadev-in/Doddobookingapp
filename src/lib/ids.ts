export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
export const token = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
