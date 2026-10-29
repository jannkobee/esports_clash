// Explicit historical kit fixture. Never imported by the playable app.
import {readFileSync} from 'node:fs';
export const CHAMPIONS=JSON.parse(readFileSync(new URL('../../../docs/avatar-rework/baseline/catalog.json',import.meta.url),'utf8')).champions;
