const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('single utf8 declaration and responsive viewport',()=>{assert.equal((html.match(/<meta charset=/g)||[]).length,1);assert.match(html,/width=device-width, initial-scale=1/);});
test('class choices support keyboard and pressed state',()=>{for(const cls of ['warrior','mage','thief'])assert.match(html,new RegExp('id="cls-'+cls+'" role="button" tabindex="0" aria-pressed='));assert.match(html,/setAttribute\('aria-pressed', 'true'\)/);});
test('touch and reduced motion styles retained',()=>{assert.match(html,/min-height: 44px/);assert.match(html,/prefers-reduced-motion: reduce/);});
