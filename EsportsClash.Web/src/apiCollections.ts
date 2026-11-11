/** Laravel collections may retain keys after filtering or cache rehydration. */
export function apiRecords<T>(value:unknown):T[] {
  const entries=Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[];
  return entries.filter(item=>item!==null&&typeof item==='object') as T[];
}
