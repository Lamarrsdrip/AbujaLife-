import crypto from 'node:crypto';
export const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
