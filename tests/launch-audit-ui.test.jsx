import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ContactScreen from '../src/ContactScreen.jsx';
import {Home} from '../src/WebSupport.jsx';
import MatchLobby from '../src/MatchLobby.jsx';

test('footer deletion opens the support form with deletion preselected; support labels keep an accessible hint',()=>{
 const html=renderToStaticMarkup(<Home/>);assert(html.includes('href="/contact?topic=deletion#contact-form"'));
 const prior=globalThis.location;try{globalThis.location={search:'?topic=deletion'};const form=renderToStaticMarkup(<ContactScreen/>);assert(form.includes('id="contact-form"'));assert(/<option value="deletion" selected="">/.test(form));assert(form.includes('aria-describedby="contact-message-hint"'));assert(form.includes('15–3.000 tegn'));}finally{if(prior===undefined)delete globalThis.location;else globalThis.location=prior;}
});
test('pregame presents provided real strengths and tactical plan without inventing opponent names',()=>{
 const html=renderToStaticMarkup(<MatchLobby home="Prøvelund BK" away="Havneby IF" homeStrength={65} opposition={58} tactic="Balanceret" formation="4-3-3"/>);
 for(const value of ['65/99','58/99','Balanceret','Havneby IF','Individuelle navne er ikke tilgængelige'])assert(html.includes(value),value);
 const legacy=renderToStaticMarkup(<MatchLobby formation="4-3-3"/>);assert(!legacy.includes('undefined/99'));
});
