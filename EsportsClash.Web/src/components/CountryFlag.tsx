import {useId} from 'react';
import {Globe} from 'lucide-react';
import {countryDetails} from '../countries';
/** Real, local SVG artwork; readable on platforms that render emoji flags as letters. */
export function CountryFlag({code,name,showName=false,focusable=true}:{code?:string|null;name?:string|null;showName?:boolean;focusable?:boolean}){
 const country=countryDetails(code,name),id=useId(),label=country?.name??name??'Country not recorded';
 return <span className={'country-flag'+(showName?' country-flag--named':'')} tabIndex={!showName&&focusable?0:undefined} title={label} aria-label={showName?undefined:label} aria-describedby={id}>{country?<img src={import.meta.env.BASE_URL+'flags/'+country.code.toLowerCase()+'.svg'} width={24} height={18} alt="" aria-hidden="true" loading="lazy"/>:<Globe size={19} aria-hidden="true"/>}{showName&&<span>{label}</span>}<span role="tooltip" id={id} className="country-flag-tooltip">{label}{country&&<small>{country.code}</small>}</span></span>;
}
