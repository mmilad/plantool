import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appPath, parseAppRoute, renderAppHtml } from '../src/ui.js';
import vm from 'node:vm';

test('application paths resolve projects, views, tickets and documents', () => {
  const project = 'a1b2c3d4e5f6', ticket = '01a20e3f-cc21-7bb0-a603-6a62450cb6cf', document = '01a20e40-1234-7000-8000-000000000000';
  assert.deepEqual(parseAppRoute('/'), { type: 'projects' });
  assert.deepEqual(parseAppRoute('/' + project), { type: 'project', projectId: project, view: 'overview' });
  assert.deepEqual(parseAppRoute('/' + project + '/list'), { type: 'project', projectId: project, view: 'tickets' });
  assert.deepEqual(parseAppRoute('/' + project + '/list/' + ticket), { type: 'project', projectId: project, view: 'tickets', ticketId: ticket, list: true });
  assert.deepEqual(parseAppRoute('/' + project + '/board'), { type: 'project', projectId: project, view: 'board' });
  assert.deepEqual(parseAppRoute('/' + project + '/' + ticket), { type: 'project', projectId: project, view: 'tickets', ticketId: ticket });
  assert.deepEqual(parseAppRoute('/' + project + '/documents/' + document), { type: 'project', projectId: project, view: 'documents', documentId: document });
  assert.equal(parseAppRoute('/not-a-project/list'), null);
  assert.equal(parseAppRoute('/' + project + '/unknown/deeper'), null);
  assert.equal(appPath(project), '/' + project);
  assert.equal(appPath(project, 'tickets'), '/' + project + '/list');
  assert.equal(appPath(project, 'list-ticket', ticket), '/' + project + '/list/' + ticket);
  assert.equal(appPath(project, 'ticket', ticket), '/' + project + '/' + ticket);
  assert.equal(appPath(project, 'document', document), '/' + project + '/documents/' + document);
});

test('the web UI has a decisions view and its script parses', () => {
  const html = renderAppHtml('token');
  assert.ok(html.includes("in_planning:'In planning'"));
  assert.ok(html.includes("count(t=>t.status==='in_planning')"));
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
  assert.ok(html.includes('data-roadmap-mode="graph"'));
  assert.ok(html.includes('id="roadmap-graph-root"'));
  assert.ok(html.includes('id="roadmap-graph-status"'));
  assert.ok(html.includes('id="roadmap-graph-canvas"'));
  assert.ok(html.includes("'/api/roadmap/graph?'+params"));
  assert.ok(html.includes("mode=graph"));
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
