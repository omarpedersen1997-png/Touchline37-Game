import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import AuthScreen from '../src/AuthScreen.jsx';
import AccountSettings from '../src/AccountSettings.jsx';
import DeleteAccount from '../src/DeleteAccount.jsx';
import ContactScreen from '../src/ContactScreen.jsx';
import {mergeAccountAccess,initialAccountAccess} from '../src/account-access.js';

const noop=()=>{};
const testCapabilities=Object.freeze({testEnvironment:true,emailDelivery:false,registration:false,accountChanges:false});
const user={email:'tester@touchline.invalid',emailVerified:false};

test('older capability replies keep normal account actions while explicit test identity disables them',()=>{
 for(const data of [undefined,null,{}, {emailDelivery:false},{registration:false,accountChanges:false}]){
  const access=mergeAccountAccess(null,data);
  assert.equal(access.testEnvironment,false);assert.equal(access.registration,true);assert.equal(access.accountChanges,true);
 }
 assert.equal(initialAccountAccess().registration,true);
 assert.deepEqual(mergeAccountAccess(null,testCapabilities),testCapabilities);
});

test('known test access cannot reopen after failed, stale or contradictory capability replies',()=>{
 const previous=mergeAccountAccess(null,testCapabilities);
 for(const data of [undefined,null,{}, {testEnvironment:false,emailDelivery:true,registration:true,accountChanges:true}]){
  const next=mergeAccountAccess(previous,data);
  assert.deepEqual(next,testCapabilities);
  assert(Object.isFrozen(next));
 }
 assert.equal(testCapabilities.registration,false);
});

test('test login explains the supplied account and exposes neither signup nor destructive/support routes',()=>{
 const html=renderToStaticMarkup(<AuthScreen onAuthenticated={noop} initialCapabilities={testCapabilities}/>);
 assert(html.includes('Testudgave: Brug den udleverede testkonto.'));
 assert(html.includes('id="auth-email"'));assert(html.includes('Fortsæt'));
 assert(!html.includes('Opret konto'));assert(!html.includes('href="/delete-account"'));assert(!html.includes('href="/contact"'));
 assert(html.includes('href="/privacy"'));assert(!html.includes('Glemt adgangskoden?'));
});

test('test settings and deletion screens explain restrictions without a submission form',()=>{
 const settings=renderToStaticMarkup(<AccountSettings user={user} onUpdated={noop} onBack={noop} initialCapabilities={testCapabilities}/>);
 assert(settings.includes(user.email));assert(settings.includes('Testkontoen kan ikke ændres eller slettes'));
 assert(!settings.includes('<form'));assert(!settings.includes('Du kan stadig ændre adgangskoden'));
 const deletion=renderToStaticMarkup(<DeleteAccount email={user.email} onDeleted={noop} onCancel={noop} initialCapabilities={testCapabilities}/>);
 assert(deletion.includes('Kontosletning er slået fra'));assert(deletion.includes('Tilbage til indstillinger'));
 assert(!deletion.includes('<form'));assert(!deletion.includes('Slet min konto permanent'));
});

test('test contact view cannot solicit personal email or messages for the disabled endpoint',()=>{
 const html=renderToStaticMarkup(<ContactScreen initialCapabilities={testCapabilities}/>);
 assert(html.includes('Kontaktformularen er slået fra'));assert(html.includes('hvor du fik testappen'));
 assert(!html.includes('<form'));assert(!html.includes('name="email"'));assert(!html.includes('name="message"'));assert(!html.includes('Send besked'));
});

test('normal app keeps signup, password changes, permanent deletion and the contact form',()=>{
 const auth=renderToStaticMarkup(<AuthScreen onAuthenticated={noop}/>);assert(auth.includes('Opret konto'));assert(auth.includes('href="/delete-account"'));assert(auth.includes('href="/contact"'));
 const settings=renderToStaticMarkup(<AccountSettings user={user} onUpdated={noop} onBack={noop}/>);assert(settings.includes('id="current-password"'));assert(settings.includes('id="new-password"'));assert(settings.includes('Skift adgangskode'));
 const deletion=renderToStaticMarkup(<DeleteAccount email={user.email} onDeleted={noop} onCancel={noop}/>);assert(deletion.includes('id="delete-password"'));assert(deletion.includes('Slet min konto permanent'));
 const contact=renderToStaticMarkup(<ContactScreen/>);assert(contact.includes('name="email"'));assert(contact.includes('name="message"'));assert(contact.includes('Send besked'));
});
