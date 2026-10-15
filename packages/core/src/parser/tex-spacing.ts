/** Bounded literal distances shared by explicit and automatic formula parsing. */
export function horizontalSpaceAt(source:string,afterName:number):{end:number;value:string;start:number;valueEnd:number;starred:boolean}|undefined {
 let cursor=afterName;
 while(cursor<source.length && /\s/.test(source[cursor]))cursor++;
 const starred=source[cursor]==='*';if(starred)cursor++;
 while(cursor<source.length && /\s/.test(source[cursor]))cursor++;
 const distance='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)\\s*(?:em|ex|mu|pt|bp|pc|mm|cm|in|dd|cc|nd|nc|sp)';
 if(source[cursor]==='{') {
  const group=/^\{([^{}]*)\}/.exec(source.slice(cursor));
  if(!group || !new RegExp('^\\s*'+distance+'\\s*$').test(group[1]))return;
  return {end:cursor+group[0].length,value:group[1],start:cursor+1,valueEnd:cursor+group[0].length-1,starred};
 }
 const unbraced=new RegExp('^'+distance).exec(source.slice(cursor));
 if(unbraced)return {end:cursor+unbraced[0].length,value:unbraced[0],start:cursor,valueEnd:cursor+unbraced[0].length,starred};
}
