# 맵 만들기 (v5)

맵 파일 하나 = `SandTag.registerMap({...})` 한 번. 파일을 `maps/` 에 넣고 `maps/index.js` 의 `MAP_FILES` 에 이름을 더하면 메뉴에 나타나요.
게임을 열면 콘솔과 메뉴에 **맵 검사** 결과가 나와요 (갈 수 없는 스폰·구슬·목표 지점 등).

## 좌표
- 바닥 칸 하나 = **4m**. `grid` 의 글자 하나가 한 칸이에요. x 는 오른쪽(동), z 는 아래쪽(남).
- 건물·상자·소품 위치는 **미터** 단위예요. 칸 (c, r) 의 가운데 = (c*4+2, r*4+2) m.
- 북쪽(z 작은 쪽)이 술래/레드 쪽, 남쪽이 도망자/블루 쪽이에요.

## grid 글자
| 글자 | 뜻 |
|---|---|
| `#` | 바위·외벽 (높이 `rockH`) |
| `.` | 바닥 |
| `~` | 낭떠러지 (떨어지면 배틀은 사망, 술래잡기는 스폰으로) |
| `D` | 탈출문 (술래잡기, 구슬을 다 모으면 열림) |
| `1`~`9` | 그 높이(m)의 낮은 바위 |

## 건물 `buildings`
```js
{name:'A 타워', x:32, z:46, w:12, d:18, floors:3, fh:4, style:'white',
 doors:[['n',6,0],['w',12,0]],           // [벽, 벽 시작에서 거리(m), 층, (폭)]
 stairs:[{x:1,z:2,len:8,dir:'n'},{x:8,z:7,len:8,dir:'s',from:1}],  // 계단: 건물 안 좌표, 올라가는 방향, 시작 층
 rooms:[{x0:0,z0:0,x1:12,z1:8,floor:1,doors:[['s',6]]}],          // 칸막이 방
 atria:[{x0:4,z0:4,x1:10,z1:10,floor:1}],                         // 위층 바닥에 뚫린 아트리움 (난간 자동)
 ladders:[['n',9]],                       // 옥상까지 바깥 사다리
 open:[['e',0]],                          // 그 층의 한 면을 통째로 트기 (기둥·난간 자동)
 roofGaps:[['s',15,4.6]],                 // 옥상 난간 틈 (바깥 계단이 닿는 곳)
 roof:'parapet', garden:true, sign:'CLUB'}
```
- 문·창문 가운데는 자동으로 홀수 미터에 맞춰져요 (길찾기 격자 2m 와 맞추려고).
- 스타일: `white metal ruin corrugated concrete neo neon garage shop factory office brick`

## 그 밖의 물체
- `boxes`: `{x0,x1,z0,z1,y0,y1,k}` — k: `container cover bridge rail pillar pool track car vending silo catwalk dock truck machine conveyor slide`
  - `destr:true, hp:500` 이면 부서져요 (부서지는 다리 등). `k:'slide'` 는 슬라이딩으로만 지나가는 통로.
- `ramps`: `{x0,x1,z0,z1,hi:'z0',h:4.5,base:0,k:'stairs'}` — 경사로(계단 모양)
- `ladders`: `{x,z,face:'n',y0:0,y1:12}` — face 는 올라가며 미는 방향
- `crates:[[x,z,높이,'steel']]`, `barrels:[[x,z]]` (폭발 드럼통), `planters:[[x,z,w,d,'cone'|'round'|null,y0]]`
- `props:[{m:'barrel_rust',x,z,rot,s,solid:[w,d,h]}]` — `assets/models/*.glb` 소품
- `decor` — 맵 바깥 장식 (`tower dish facade pipe sign neon billboard holo cables steam sail chimney crane skyline`)
  - `neon`/`billboard` 의 `rot` 는 간판 앞면이 보는 방향: 0=남(+z), π=북, π/2=동(+x), −π/2=서. 벽에서 0.2 m 바깥에 두세요.
  - `crane` 은 충돌이 없으니 담 밖에만 두세요.
- `place:[[종류,x0,z0,회전(0|1),색?,뒤집기?]]` — 자동 소품을 원하는 자리에 직접 놓기 (x0,z0 = 왼쪽 위 모서리, 충돌 포함).
  종류: `cont cont2 contL sedan van pickup truck pipes bags bags2 spool dumpster jersey crates sandbag sandbagL hesco gcar cement tyres drums ibc milc tank shelter bench kiosk bollards`
  - 그 뒤에 남은 빈 곳은 `afDensity`(작을수록 많이) 만큼 자동으로 채워져요 (`autoFill:false` 로 끔). 테마별 세트: factory desert plaza cyber.
- `paint:[{t,…}]` — 바닥 도색. `line {x0,z0,x1,z1,c}` · `box {x0,z0,x1,z1,c,lw}` · `hazard {x0,z0,x1,z1}` · `park {x0,z0,x1,z1,n,c}` · `zebra {x0,z0,x1,z1}` · `arrow {x,z,rot,c}` · `text {x,z,w,txt,c,rot}`
- `puddles:[[x,z,반지름]]` — 반사되는 물웅덩이. 비 오는 테마는 지정 안 하면 자동(`puddleCount`, 건물 안 제외).
- `roads:[{x0,z0,x1,z1}]` — 아스팔트 도로 (공장처럼 `yard` 테마).

## 술래잡기
`spawns.runner / spawns.seeker`, `zones`(노란 구역, 칸 단위), `orbs.zones / orbs.up / orbs.ground`(구슬 후보 칸), `door`, `jail`, `portals`(2개)

## 배틀 `battle`
`spawnsA`(블루, 남쪽), `spawnsB`(레드, 북쪽), `points`(점령전 A·B·C), `hardpoints`, `sites`(수색과 파괴 A·B), `flags`(깃발 뺏기 [블루 기지, 레드 기지]), `upload.drive / upload.goals`, `parkour.waypoints`(이 선을 따라 발판이 자동 생성돼요)
