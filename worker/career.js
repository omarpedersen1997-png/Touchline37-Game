import{wonMatch,drawnMatch}from'./management.js';
export function ensureCareer(s,now){s.career||={startedAt:now,matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,signings:0,promotions:0};s.career.topFlightTitles??=0;s.career.europeanTitles??=0;return s.career}
export function recordCareerMatch(s,match,now){const c=ensureCareer(s,now);c.matches++;c.goalsFor+=match.home;c.goalsAgainst+=match.away;if(wonMatch(match))c.wins++;else if(drawnMatch(match))c.draws++;else c.losses++}
