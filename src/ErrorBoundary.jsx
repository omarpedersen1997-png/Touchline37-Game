import {initialAccountAccess} from './account-access.js';
import {gameHome,documentLink} from './api.js';
import React from'react';
export default class ErrorBoundary extends React.Component{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?<main className="app-failure" role="alert"><span>TOUCHLINE · OPNEXT GAMES</span><h1>Klubhuset kunne ikke vises.</h1><p>Prøv at åbne appen igen. Dine allerede gemte fremskridt bevares.</p><button onClick={()=>location.assign(gameHome)}>Prøv igen</button>{initialAccountAccess().testEnvironment?<p>Giv din tilbagemelding i samtalen, hvor du fik testudgaven.</p>:<a href={documentLink('/contact')}>Kontakt support</a>}</main>:this.props.children}}
