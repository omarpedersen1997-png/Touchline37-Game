import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeDisplay = registerPlugin('TouchlineMatchDisplay');
let requested = false;
let active = false;
let nativeSession = false;
let lockedOrientation = null;
let transition = Promise.resolve();

function nativeAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('TouchlineMatchDisplay');
}

async function synchronize() {
  if (active === requested) return;
  if (requested) {
    const native = nativeAvailable();
    nativeSession = native;
    let orientationLocked = null;
    globalThis.addEventListener?.('pagehide', leavePage);
    if (native) {
      try {
        await NativeDisplay.enter();
      } catch (error) {
        nativeSession = false;
        globalThis.removeEventListener?.('pagehide', leavePage);
        throw error;
      }
    } else {
      // Browsers may require fullscreen or decline this API. The match UI handles
      // portrait screens; importing this module never locks the public website.
      const orientation = globalThis.screen?.orientation;
      if (typeof orientation?.lock === 'function' && typeof orientation?.unlock === 'function') {
        try {
          await orientation.lock('landscape');
          orientationLocked = orientation;
          lockedOrientation = orientation;
        } catch { /* Orientation locking is optional on the web. */ }
      }
    }
    // Cleanup can arrive while either platform is still entering its display mode.
    if (!requested) {
      try {
        if (native) await NativeDisplay.exit();
        else orientationLocked?.unlock();
      } finally {
        nativeSession = false;
        lockedOrientation = null;
        globalThis.removeEventListener?.('pagehide', leavePage);
      }
      return;
    }
    nativeSession = native;
    active = true;
  } else {
    try {
      if (nativeSession) await NativeDisplay.exit();
      else lockedOrientation?.unlock();
    } finally {
      active = false;
      nativeSession = false;
      lockedOrientation = null;
      globalThis.removeEventListener?.('pagehide', leavePage);
    }
  }
}

function leavePage() {
  requested = false;
  // Send directly during document teardown. Native navigation callbacks also
  // restore the window if the departing JS context cannot complete its cleanup.
  if (nativeSession) void NativeDisplay.exit().catch(() => {});
  else lockedOrientation?.unlock();
  active = false;
  nativeSession = false;
  lockedOrientation = null;
  globalThis.removeEventListener?.('pagehide', leavePage);
}

function schedule() {
  // Serialize effect mount/unmount transitions, including React StrictMode and
  // closing a match while a browser orientation request is still pending.
  transition = transition.catch(() => {}).then(synchronize);
  return transition;
}

export function enterMatchDisplay() {
  requested = true;
  return schedule();
}

export function exitMatchDisplay() {
  requested = false;
  return schedule().finally(releaseMatchExpansion);
}

let ownedFullscreen=false;
export async function toggleMatchExpansion(element=globalThis.document?.documentElement){
 if(nativeAvailable()){
  if(requested){await exitMatchDisplay();return false;}
  await enterMatchDisplay();return true;
 }
 const doc=globalThis.document;
 if(ownedFullscreen&&doc?.fullscreenElement){await doc.exitFullscreen();ownedFullscreen=false;return false;}
 if(typeof element?.requestFullscreen!=='function')return false;
 await element.requestFullscreen();ownedFullscreen=true;
 await enterMatchDisplay();return true;
}
export async function releaseMatchExpansion(){
 if(ownedFullscreen){ownedFullscreen=false;if(globalThis.document?.fullscreenElement)try{await document.exitFullscreen();}catch{}}
}
export function matchDisplayExpanded(){
 return !!(active&&nativeSession||globalThis.document?.fullscreenElement);
}
