# VRChat 그룹 멤버 크롤링 메모

대상 그룹: `grp_38154c25-69f7-43da-8905-2da2d04db615`
저장 위치: `J:\Github\VRCWorld\Group\` (드라이브 문자는 바뀔 수 있음)
멤버 목록: `Group/Members.json` (userId, displayName / userId 오름차순 정렬)
메타: `Group/MembersMeta.json`

## 실행 판단
- **업데이트 크롤**: `Members.json` 이 있으면 매일 진행. 감사로그(auditLogs)로 직전 `updatedAt` 이후 join/leave 만 반영.
- **전체 크롤**: 마지막 `fullCrawledAt` 로부터 7일 초과 시, `/groups/{gid}/members` API 로 전체 재수집.

## 메타데이터 규칙
- `updatedAt` / `fullCrawledAt` 는 각각 **크롤 시작 시각의 5분 전** 을 기록.
  (크롤 도중 가입자가 다음 실행에서 누락되지 않도록 하는 안전 여유.)
- 두 시각은 분리 기록. `memberCount` 도 갱신.

## API 노트
- 로그인 필요 → **Chrome MCP** 의 로그인된 vrchat.com 탭에서 `javascript_tool` 로 `fetch(..., {credentials:'include'})` 호출.
- 감사로그: `GET https://vrchat.com/api/1/groups/{gid}/auditLogs?n=100&offset=N`
  - 응답: `{ results:[{eventType, created_at, targetId, actorDisplayName, ...}], totalCount, hasNext }`
  - 관련 이벤트타입: `group.member.join`, `group.member.leave`(탈퇴/킥/밴 포함 관측), `group.member.remove`(있을 경우)
  - join 시 `targetId`=가입자 userId, `actorDisplayName`=표시명.
- 전체 멤버: `GET https://vrchat.com/api/1/groups/{gid}/members?n=100&offset=N` 로 페이지네이션.

## Chrome MCP javascript_tool 반출 주의 (중요)
- 출력이 **Base64/JWT 패턴이면 `[BLOCKED]`** 로 가려지고, 대략 **~1000자에서 잘림**.
- 큰 결과(diff, Members.json)는 **Blob 다운로드**로 파일 반출:
  `URL.createObjectURL(new Blob([str]))` → `<a download>` 클릭 → `Downloads/` 에서 회수.
- 유니코드 표시명 깨짐/경계 잘림을 피하려면 청크 텍스트 복사 대신 위 다운로드 방식 사용.

## 병합 시 주의
- join/leave 는 **이벤트 시간순(오름차순)** 으로 map 에 순차 적용해야 정확
  (같은 윈도우에서 join→leave 또는 leave→join 이 섞이는 경우 대비). `update-crawl.js` 의 `merge()` 참조.

## 포맷
- `Members.json`: `JSON.stringify(arr, null, 1)` (배열 1칸 들여쓰기, LF, **끝 개행 없음**).

## 마무리
- 파일 갱신 후 **반드시 `git add` → `commit` → `push`**.

## 최근 실행 로그
- 2026-07-23 (UTC) 업데이트 크롤: +105 가입 / -59 탈퇴 → 18788 → **18834명**. (엣지케이스 없음, totalCount 3379)
- 2026-07-22 (UTC) 업데이트 크롤: +60 가입 / -50 탈퇴 → 18778 → **18788명**. (엣지케이스 없음)
- 2026-07-21 (UTC) 업데이트 크롤: +97 가입 / -34 탈퇴 → 18715 → **18778명**.
  (그중 2명은 같은 윈도우에서 join→leave 라 최종 미포함이 정상.)
