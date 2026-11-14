import {gameHome} from './api.js';
import React from'react';
export default class ErrorBoundary extends React.Component{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?<main className="app-failure" role="alert"><span>TOUCHLINE · OPNEXT GAMES</span><h1>Klubhuset kunne ikke vises.</h1><p>Prøv at åbne appen igen. Din klub ligger gemt på serveren.</p><button onClick={()=>location.assign(gameHome)}>Prøv igen</button><a href="/contact">Kontakt support</a></main>:this.props.children}}
