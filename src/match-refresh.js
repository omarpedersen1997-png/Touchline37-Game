const key='touchline:match-refresh:v1';
export function readMatchRefresh(storage){try{const value=JSON.parse(storage?.getItem(key)||'null');return value?.schema===1&&value.rate===120?120:60;}catch{return 60;}}
export function saveMatchRefresh(rate,storage){if(![60,120].includes(rate))return;try{storage?.setItem(key,JSON.stringify({schema:1,rate}));}catch{}}
