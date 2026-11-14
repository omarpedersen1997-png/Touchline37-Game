import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{writeFileSync}from'node:fs';
import ArenaScene from'../src/ArenaScene.jsx';
import{KitPreview,ClubBadge}from'../src/ClubStudio.jsx';
const style={color:'blue',pattern:'stripe',crest:'diamond',motto:'Én klub. Én drøm.'};
for(const[name,element]of[
 ['arena-2',<ArenaScene stage={3} name="Nordhavn Arena" clubColor="lime"/>],
 ['kit-2',<KitPreview style={style} number={9}/>],
 ['badge-2',<ClubBadge style={style} name="Nordhavn FC" size={160}/>]
]){
 const html=renderToStaticMarkup(element);const start=html.indexOf('<svg'),end=html.indexOf('</svg>',start)+6;
 const svg=html.slice(start,end).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
 writeFileSync(`assets/site/${name}.svg`,svg+'\n');
}
