// VRChat 그룹 멤버 증분(업데이트) 크롤 - Chrome MCP javascript_tool 에서 실행
// 로그인된 vrchat.com 탭에서 실행할 것 (세션 쿠키로 API 인증됨).
//
// 사용법:
//   1) https://vrchat.com 아무 페이지(로그인 상태)에서 아래 순서대로 실행
//   2) cutoff = 직전 MembersMeta.json 의 updatedAt 값으로 설정
//   3) 최종 산출물(diff / Members)은 Blob download 로 반출 (아래 "반출 노트" 참고)

const GID = 'grp_38154c25-69f7-43da-8905-2da2d04db615';

// ── STEP 1. 감사로그(auditLogs) 페이지네이션으로 cutoff 이후 이벤트 수집 ──
async function collectEvents(cutoffIso) {
  const cutoff = new Date(cutoffIso).getTime();
  let offset = 0, all = [], done = false, pages = 0;
  while (!done && pages < 60) {
    const r = await fetch(`https://vrchat.com/api/1/groups/${GID}/auditLogs?n=100&offset=${offset}`,
      { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (r.status !== 200) { all.push({ __err: r.status }); break; }
    const j = await r.json();
    const res = j.results || [];
    for (const e of res) {
      if (new Date(e.created_at).getTime() < cutoff) { done = true; break; }
      all.push({ t: e.eventType, at: e.created_at, uid: e.targetId, name: e.actorDisplayName });
    }
    pages++;
    if (res.length < 100) done = true;
    offset += 100;
    await new Promise(s => setTimeout(s, 300)); // rate-limit 회피
  }
  return all;
}

// ── STEP 2. 이벤트 → join/leave 리스트 (시간순 오름차순) ──
function buildDiff(events) {
  const asc = events.slice().sort((a, b) => new Date(a.at) - new Date(b.at));
  const joins = [], leaves = [];
  for (const e of asc) {
    if (e.t === 'group.member.join') joins.push({ userId: e.uid, displayName: e.name });
    else if (e.t === 'group.member.leave' || e.t === 'group.member.remove') leaves.push(e.uid);
  }
  return { joins, leaves };
}

// ── STEP 3. 기존 Members.json(GitHub raw) 과 병합 → 최종 배열 ──
// 주의: join→leave / leave→join 이 한 윈도우에 섞이면 "시간순"으로 처리해야 정확.
// 아래는 이벤트 시간순으로 map 에 순차 적용하여 순서를 보존한다.
async function merge(events) {
  const r = await fetch('https://raw.githubusercontent.com/ahzkwid/VRCWorld/main/Group/Members.json', { cache: 'no-store' });
  const arr = await r.json();
  const map = new Map(arr.map(m => [m.userId, m.displayName]));
  const asc = events.slice().sort((a, b) => new Date(a.at) - new Date(b.at));
  for (const e of asc) {
    if (e.t === 'group.member.join') map.set(e.uid, e.name);
    else if (e.t === 'group.member.leave' || e.t === 'group.member.remove') map.delete(e.uid);
  }
  const finalArr = [...map.entries()]
    .map(([userId, displayName]) => ({ userId, displayName }))
    .sort((a, b) => a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0);
  return finalArr; // JSON.stringify(finalArr, null, 1) 로 저장 (기존 포맷과 동일)
}

// ── 반출 노트 ──
// javascript_tool 출력은 Base64/JWT 패턴을 [BLOCKED]로 막고, ~1000자에서 잘림.
// 따라서 큰 결과는 Blob 다운로드로 파일 반출한다:
//   const s = JSON.stringify(finalArr, null, 1);
//   const url = URL.createObjectURL(new Blob([s], {type:'application/json'}));
//   const a = document.createElement('a'); a.href=url; a.download='Members_new.json';
//   document.body.appendChild(a); a.click(); a.remove();
// 다운로드 폴더(C:\Users\<user>\Downloads)에서 회수 → 리포지토리로 복사.
