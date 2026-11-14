import React from 'react';
import {Activity,ArrowRight,Check,Clock3,Heart,Shield,Star,Target,Trophy} from 'lucide-react';
const whole=n=>Math.round(n||0).toLocaleString('da-DK');

export function CareerMatchday({active,club,player,planLabel}){
 const live=active.live;if(!live)return null;
 const plans={balanced:'Balanceret',linkup:'Spil for holdet',decisive:'Tag initiativet'};
 return <section className="pc-matchday panel" aria-labelledby="pc-matchday-title">
  <div className="pc-section-heading"><div><span className="eyebrow">DIN KAMPDAG · {live.minute}′</span><h3 id="pc-matchday-title">Nu gælder det, {player}.</h3></div><Activity size={24}/></div>
  <div className="pc-matchday-score"><span><Shield/>{club}</span><strong>{live.home}<i>:</i>{live.away}</strong><span><Shield/>{active.opponent}</span></div>
  <p className="pc-matchday-plan">Kampplan: <b>{planLabel||plans[live.plan]||plans.balanced}</b></p>
  <div className="pc-matchday-pitch" aria-hidden="true"><div className="pc-centre-circle"/><span className="pc-matchday-ball">●</span><span>SIMULERET KAMP · PERSONLIGE HØJDEPUNKTER</span></div>
  <ol className="pc-matchday-events" aria-label="Kampens højdepunkter">{[...live.events].reverse().map((event,i)=><li key={event.minute+'-'+i} className={event.personal||event.assist?'personal':''}><b>{event.minute}′</b><span>{event.text}</span>{(event.personal||event.assist)&&<Star size={16}/>}</li>)}</ol>
  <p className="pc-small-note">Kun hændelser, der allerede er spillet, vises. Kampen fortsætter, når du går tilbage til klubben.</p>
 </section>;
}

export default function CareerJourney({career,busy,onAction,section='all'}){
 const j=career.journey;if(!j)return null;
 const locked=busy||!!career.active;
 const showReadiness=section==='all'||section==='readiness';
 const showPlan=section==='all'||section==='details'||section==='gameplan';
 const showObjectives=section==='all'||section==='details'||section==='objectives';
 const showRecords=section==='all'||section==='details'||section==='records';
 return <>
  {showReadiness&&<section className="pc-readiness panel" aria-label="Form og trænerens tillid"><div className="pc-readiness-heading"><span className="eyebrow">DIN KAMPFORM</span><h3>Klar til næste fløjt?</h3></div><div><Heart size={20}/><span>Klar til kamp<strong>{whole(j.fitness)}<small> / 100 energi</small></strong></span></div><div><Shield size={20}/><span>Trænerens tillid<strong>{whole(j.coachTrust)}<small> / 100</small></strong></span></div><div><Activity size={20}/><span>Din seneste form<strong>{j.form.average===null?'—':j.form.average.toFixed(1).replace('.',',')}<small> / 10 · {j.form.matches} kampe</small></strong></span></div><p>Energi bruges på kampe og træning. Du genvinder 1 hvert andet minut, også offline. Et gratis restitutionspas giver op til 35. En frisk spiller får bedre forudsætninger for en god kampkarakter.</p><button className="quiet-button" type="button" disabled={locked||j.fitness>=100} onClick={()=>onAction({type:'player-career-rest'})}><Heart size={18}/>Restituér · 45 sek.<ArrowRight size={17}/></button></section>}
  {showPlan&&<section className="pc-gameplan panel" aria-labelledby="pc-gameplan-title"><span className="eyebrow">DIN BESLUTNING FØR KAMPEN</span><h3 id="pc-gameplan-title">Hvilket aftryk vil du sætte?</h3><p>Kampplanen påvirker holdets chancer, dine egne bidrag og energiforbruget. Spilforståelse styrker holdspillet; teknik styrker eget initiativ. Planen låses, når din aktivitet starter. Disse kampbonusser gælder simulering. I 3D afgør din styring kampens forløb; planen bestemmer fortsat energiforbruget.</p><fieldset disabled={locked}><legend>Vælg kampplan</legend><div>{j.plans.map(plan=><label className={j.plan===plan.id?'selected':''} key={plan.id}><input type="radio" name="career-gameplan" value={plan.id} checked={j.plan===plan.id} onChange={()=>onAction({type:'player-career-plan',key:plan.id})}/><span><b>{plan.name}{j.plan===plan.id&&<Check size={17}/>}</b><span>{plan.description}</span><small><Heart size={14}/>{plan.energy} energi pr. kamp</small></span></label>)}</div></fieldset>{career.position==='MÅL'&&<p className="pc-small-note">Som målmand giver eget initiativ flere redningsaktioner, men også større risiko for holdet. Holdspil prioriterer at spille bolden sikkert videre.</p>}</section>}
  {showObjectives&&<section className="pc-objectives panel" aria-labelledby="pc-objectives-title"><div className="pc-section-heading"><div><span className="eyebrow">DIN PERSONLIGE SÆSON</span><h3 id="pc-objectives-title">Træneren regner med dig.</h3></div><Target size={25}/></div><p>Du får mål, der passer til din position. Gennemførte mål og trænerens tillid får betydning for de største klubkontrakter.</p><div>{j.objectives.map(goal=><article key={goal.id}><div><b>{goal.title}</b><span>{goal.progress} / {goal.target}</span></div><progress value={goal.progress} max={goal.target} aria-label={goal.title}/><footer><span>+{whole(goal.money)} kr. · {career.level>=50?'Maksniveau':`+${goal.xp} XP`}</span><button className={goal.ready?'primary':'quiet-button'} type="button" disabled={locked||!goal.ready} onClick={()=>onAction({type:'player-career-claim-objective',key:goal.id})}>{goal.claimed?<><Check size={15}/>Hentet</>:goal.ready?'Hent belønning':'Arbejd mod målet'}</button></footer></article>)}</div><p className="pc-small-note">Færdige mål udbetales automatisk, når sæsonen slutter, hvis du ikke har hentet dem endnu. Et sæsonskifte nulstiller målene. XP bruges indtil spillerniveau 50; derefter får du stadig målbelønningens penge og trænerens tillid.</p></section>}
  {showRecords&&j.seasonArchive.length>0&&<details className="pc-season-records panel"><summary><Trophy size={20}/>Din spillerhistorie<span>{j.seasonArchive.length} sæsoner</span></summary><div>{j.seasonArchive.map(season=><article key={season.number}><b>Sæson {season.number} · {season.club}</b><span>{season.points} point · {season.averageRating.toFixed(1).replace('.',',')} i gennemsnit</span><small>{season.title?'Vindersæson':'Sæson afsluttet'}{season.award?' · Personlig pris':''}</small></article>)}</div></details>}
 </>;
}

export function CareerContractTerms({journey,value,onChange,disabled}){
 if(!journey)return null;
 return <fieldset className="pc-contract-terms" disabled={disabled}><legend>Hvilken rolle søger du i din næste klub?</legend><div>{journey.terms.map(term=><label className={value===term.id?'selected':''} key={term.id}><input type="radio" name="career-contract-role" checked={value===term.id} value={term.id} disabled={!term.eligible} onChange={()=>onChange(term.id)}/><span><b>{term.name}</b><span>{term.description}</span>{!term.eligible&&<small>{term.reason}</small>}</span></label>)}</div><p>Rollen vælges sammen med et klubskifte. Nøglespillere bruger flere kræfter og bliver vurderet strengere af træneren.</p></fieldset>;
}
