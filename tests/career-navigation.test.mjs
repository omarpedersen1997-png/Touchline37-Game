import {test} from 'node:test';
import assert from 'node:assert/strict';
import {careerHeader} from '../src/career-navigation.js';
const s={season:8,playerCareer:{wallet:175,season:{number:3}}};
test('personal header uses personal money and personal destinations, not the manager club',()=>{
 const h=careerHeader(s,'player-career',65000);
 assert.equal(h.balance,175);assert.equal(h.seasonLabel,'Spillersæson 3');
 assert.equal(h.balanceAction,'pc-match-title');assert.equal(h.seasonAction,'pc-season-title');
 assert.match(h.balanceLabel,/Karrieresaldo/);
});
test('club screens retain their live idle balance and facility/league navigation',()=>{
 for(const tab of ['club','team','league','center']){
  const h=careerHeader(s,tab,65000.5);assert.equal(h.balance,65000.5);
  assert.equal(h.balanceAction,'upgrades');assert.equal(h.seasonAction,'league');assert.equal(h.seasonLabel,'Sæson 8');
 }
});
test('career creation does not link to a nonexistent personal match or season',()=>{
 const h=careerHeader({season:1,playerCareer:null},'player-career',1500);
 assert.equal(h.balance,0);assert.equal(h.balanceAction,null);assert.equal(h.seasonAction,null);
 assert.equal(h.seasonLabel,'Opret din spiller');
});
