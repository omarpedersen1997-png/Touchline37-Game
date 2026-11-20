// Serverens testmarkør må ikke glemmes ved et senere mislykket capabilities-kald.
// Ældre servere uden markøren beholder den eksisterende kontoadgang.
import {useEffect,useState} from 'react';
import {apiFetch} from './api.js';
export function mergeAccountAccess(previous, incoming) {
  const testEnvironment = previous?.testEnvironment === true || incoming?.testEnvironment === true;
  return Object.freeze({
    testEnvironment,
    registration: !testEnvironment,
    accountChanges: !testEnvironment,
    emailDelivery: !testEnvironment && incoming?.emailDelivery === true,
  });
}

export function initialAccountAccess(capabilities) {
  const compiledTest = typeof __TOUCHLINE_TEST_APP__ !== 'undefined' && __TOUCHLINE_TEST_APP__;
  return mergeAccountAccess(compiledTest ? { testEnvironment: true } : null, capabilities);
}

export function useAccountAccess(capabilities) {
  const [access,setAccess] = useState(() => initialAccountAccess(capabilities));
  useEffect(() => {
    if (access.testEnvironment) return;
    let alive = true;
    apiFetch('/api/auth/capabilities').then(response => {
      if (!response.ok) throw new Error('Capabilities unavailable');
      return response.json();
    }).then(data => { if (alive) setAccess(previous => mergeAccountAccess(previous,data)); })
      .catch(() => { if (alive) setAccess(previous => mergeAccountAccess(previous,null)); });
    return () => { alive = false; };
  },[]);
  return access;
}
