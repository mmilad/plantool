import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAppHtml } from '../src/ui.js';
import vm from 'node:vm';

test('the web UI has a decisions view and its script parses', () => {
  const html = renderAppHtml('token');
  assert.ok(html.includes('id="decisions-page"'));
  assert.ok(html.includes('data-view="decisions"'));
  assert.ok(html.includes('id="decision-needs-person"'));
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, 'page has an inline script');
  assert.doesNotThrow(() => new Function(script));
});

test('the roadmap has structure, timeline and dependency routes and keeps its controls in the page', () => {
  const html = renderAppHtml('token');
  assert.ok(html.includes('data-view="roadmap"'));
  assert.ok(html.includes('id="roadmap-page"'));
  assert.ok(html.includes('data-roadmap-mode="structure"'));
  assert.ok(html.includes('data-roadmap-mode="timeline"'));
  assert.ok(html.includes('data-roadmap-mode="deps"'));
  assert.ok(html.includes('id="roadmap-deps-root"'));
  assert.ok(html.includes('id="roadmap-deps-finished"'));
  assert.ok(html.includes('id="roadmap-deps-table"'));
  assert.ok(html.includes("'/api/roadmap/deps?'+params"));
  assert.ok(html.includes("mode=deps"));
  assert.ok(html.includes('data.omittedEdges'));
  assert.ok(html.includes('id="roadmap-status"'));
  assert.ok(html.includes('id="roadmap-range"'));
  assert.ok(html.includes("'/api/roadmap/'+(isStructure?'structure':'timeline')"));
  assert.ok(html.includes('completionSource===\'updatedAt\''));
  assert.ok(html.includes('error.code===\'STALE_ROADMAP\''));
  assert.ok(html.includes('if(request!==state.roadmapRequest)return;'));
  assert.ok(html.includes('state.roadmapRequest++;'));
  assert.ok(html.includes('state.roadmapCollapsed.has(item.id)'));
  assert.ok(html.includes('item.rollup===\'blocked\'&&!hasBlockers'))
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, 'page has an inline script');
  assert.doesNotThrow(() => new Function(script));
});

test('manual and disk-change refresh await the visible roadmap and retain page position', async () => {
  const script=/<script>([\s\S]*?)<\/script>/.exec(renderAppHtml('token'))[1];
  const functions=['loadRoadmap','refreshProject'].map(name=>script.split('\n').find(line=>line.includes(`function ${name}(`))).join('\n');
  for(const mode of ['structure','timeline','deps']) {
    const calls=[];
    const state={view:'roadmap',roadmapMode:mode,roadmapStructure:{offset:100},roadmapTimeline:{offset:200},versionParts:{tree:'old',documents:'same',comments:'same'}};
    const context={state,byId:()=>({scrollTop:25}),loadTree:async()=>calls.push('tree'),setRefreshStatus:()=>{},clearTimeout:()=>{},setTimeout:()=>0,
      loadRoadmapPage:async(which,offset)=>{await Promise.resolve();calls.push([which,offset]);},
      loadRoadmapDeps:async()=>{await Promise.resolve();calls.push(['deps']);}};
    vm.createContext(context);vm.runInContext(functions,context);
    await context.refreshProject({manual:true});
    assert.deepEqual(calls,['tree',mode==='deps'?['deps']:[mode,mode==='timeline'?200:100]]);
    calls.length=0;
    await context.refreshProject({parts:{tree:'new',documents:'same',comments:'same'}});
    assert.equal(calls.length,2,'disk changes reload the visible roadmap');
    calls.length=0;
    await context.refreshProject({parts:state.versionParts});
    assert.equal(calls.length,0,'unrelated unchanged data does not reload the roadmap');
  }
});
