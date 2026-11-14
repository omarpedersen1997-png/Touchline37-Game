import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import SiteGallery, {GalleryDialogContent} from '../src/SiteGallery.jsx';
import {SCREENSHOTS} from '../src/site-gallery-data.js';
import {Home} from '../src/WebSupport.jsx';
import launchPlan from '../release/launch.json';

test('website gallery exposes four original captures without opening a dialog on arrival',()=>{
 const html=renderToStaticMarkup(<SiteGallery/>);
 assert(html.includes('id="billeder"'));
 assert.equal((html.match(/<figure/g)||[]).length,4);
 assert.equal((html.match(/loading="lazy"/g)||[]).length,4);
 for(const shot of SCREENSHOTS){
  assert(html.includes(`src="${shot.src}"`));
  assert(html.includes(`alt="${shot.alt}"`));
  assert(html.includes(`width="${shot.width}"`));
  assert(html.includes(`height="${shot.height}"`));
  assert(html.includes(shot.title));
 }
 assert(!html.includes('aria-modal="true"'));
 assert(!/NaN|undefined|Infinity/.test(html));
});

test('full screenshot view supplies its title, description, close and navigation controls',()=>{
 const item=SCREENSHOTS[0];
 const html=renderToStaticMarkup(<GalleryDialogContent item={item} index={0} total={SCREENSHOTS.length} onClose={()=>{}} onStep={()=>{}} dialogRef={null} closeRef={null} scrollRef={null} titleId="gallery-test-title"/>);
 assert(html.includes(item.title));
 assert(html.includes(item.description));
 assert(html.includes(`src="${item.src}"`));
 assert(html.includes('role="dialog"'));
 assert(html.includes('aria-modal="true"'));
 assert(html.includes('aria-labelledby="gallery-test-title"'));
 assert(html.includes('role="region"'));
 assert(html.includes('tabindex="0"'));
 for(const label of ['Luk','Forrige','Næste'])assert(html.includes(label));
 assert(html.includes('gallery-test-title'));
 assert(!/NaN|undefined|Infinity/.test(html));
});

test('home excludes legacy screenshots while keeping release date and current match information',()=>{
 const html=renderToStaticMarkup(<Home/>);
 assert(!html.includes('/assets/gallery/'));
 assert(!html.includes('id="billeder"'));
 assert(html.includes('id="kampen"'));
 assert(html.includes(launchPlan.label));
 assert(!html.includes('/api/game'));
 assert(!html.includes('13. november'));
});
