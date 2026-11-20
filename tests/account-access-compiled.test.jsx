import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import AuthScreen from '../src/AuthScreen.jsx';
import AccountSettings from '../src/AccountSettings.jsx';
import DeleteAccount from '../src/DeleteAccount.jsx';
import ContactScreen from '../src/ContactScreen.jsx';
import {initialAccountAccess} from '../src/account-access.js';

test('compiled test build starts restricted before any capabilities request can finish or fail',()=>{
 const access=initialAccountAccess();assert.equal(access.testEnvironment,true);assert.equal(access.registration,false);assert.equal(access.accountChanges,false);
 const props={email:'tester@touchline.invalid',onDeleted:()=>{},onCancel:()=>{},onAuthenticated:()=>{},onUpdated:()=>{},onBack:()=>{},user:{email:'tester@touchline.invalid'}};
 const login=renderToStaticMarkup(<AuthScreen {...props}/>);assert(login.includes('Testudgave: Brug den udleverede testkonto.'));assert(!login.includes('Opret konto'));
 for(const element of [<AccountSettings {...props}/>,<DeleteAccount {...props}/>,<ContactScreen/>])assert(!renderToStaticMarkup(element).includes('<form'));
});
