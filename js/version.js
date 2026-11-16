/* version.js — bump GAME_VERSION and add a line on top of GAME_CHANGES for every release.
   Open game pages re-read this file now and then and show "new version" when it changes. */
const GAME_VERSION='5.0.0';
const GAME_CHANGES=[
  ['5.0.0','완전히 새로 만든 버전: 메인 화면과 게임별 화면, 여러 명 온라인(방장 설정, 방 찾기), 배틀(무기 32종·투척 10종·특수 5종·퍼크 18종·모드 11개), 실사 질감과 하늘·그림자·후처리, 애니메이션 캐릭터, 실제 총소리, 다층 실내가 있는 맵 4종(사막 요새·네오 플라자 재설계, 사이버펑크 도시·버려진 공장 추가).'],
  ['4.0.0','그래픽 전면 개선, 그래픽 품질 설정.'],
  ['3.3.0','총 기본값 10발·재장전 3초, 몸 10·머리 15 피해, 맞으면 화면 테두리 붉게.'],
  ['3.2.0','네오 플라자, 1:1 총싸움, 술래 총, 도망자 체력, 레이더 10초, 술래 시야 60도.'],
  ['3.1.0','파일 분할, 맵 폴더, 버전 표시.'],
  ['3.0.0','점프, 슬라이딩, 2층 건물과 구름다리, 텔레포트 문, 방장 시스템.']
];
