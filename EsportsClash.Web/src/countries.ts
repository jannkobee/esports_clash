import registry from './countryDirectory.json';
export const COUNTRIES=registry;
export interface CountryOption {code:string;name:string}
export const COUNTRY_BY_CODE=new Map(COUNTRIES.map(c=>[c.code,c]));
export function countryDetails(code?:string|null,name?:string|null):CountryOption|null{
 const normalized=code?.trim().toUpperCase();const known=normalized?COUNTRY_BY_CODE.get(normalized):undefined;
 if(known)return {code:known.code,name:name||known.name};
 if(name){const alias=({'South Korea':'KR','North Korea':'KP','Russia':'RU','United States':'US','United Kingdom':'GB','Vietnam':'VN','Taiwan':'TW','Turkey':'TR','Türkiye':'TR','Iran':'IR','Laos':'LA','Bolivia':'BO','Moldova':'MD','Brunei':'BN','Czech Republic':'CZ','Czechia':'CZ','Tanzania':'TZ','Venezuela':'VE'} as Record<string,string>)[name];if(alias)return {code:alias,name};const match=COUNTRIES.find(c=>c.name.toLowerCase()===name.toLowerCase());if(match)return match;}
 return null;
}
