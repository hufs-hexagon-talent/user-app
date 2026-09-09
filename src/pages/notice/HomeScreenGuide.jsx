import React from 'react';

const SITE_URL = 'https://studyroom.computer.hufs.ac.kr';

const figureClass = 'mx-auto mb-2 block h-auto w-full max-w-[340px]';
const stepsClass =
  'm-0 grid list-decimal gap-[7px] pl-5 text-[14.5px] text-[#2C3946] marker:font-extrabold marker:text-[#2F7DC4]';
const noteClass =
  'mt-[13px] rounded-[10px] bg-[#F1EEE9] px-[14px] py-[11px] text-sm text-[#33414F]';

// 브라우저 기본 kbd 는 고정폭 글꼴이라 한글 버튼 이름이 본문과 어긋나 보인다. 글꼴은
// 본문 것을 물려받게 두고 테두리와 배경으로만 "눌러야 할 버튼"임을 표시한다.
function Kbd({ children }) {
  return (
    <kbd className="inline-block rounded-md border border-[#E4DFD8] bg-[#F1EEE9] px-[7px] py-px text-[13.5px] font-bold text-[#002D56] [font-family:inherit]">
      {children}
    </kbd>
  );
}

function DeviceCard({ name, platforms, children }) {
  return (
    <div className="mt-[14px] rounded-[14px] border border-[#DED8D0] bg-white px-[19px] pb-[19px] pt-[17px]">
      <h3 className="mb-[13px] text-[16.5px] font-extrabold tracking-[-0.02em] text-[#002D56]">
        {name}{' '}
        <span className="text-sm font-semibold text-[#54606F]">
          — {platforms}
        </span>
      </h3>
      {children}
    </div>
  );
}

// 그림 아래 두 칸짜리 요약. 단계 목록을 읽지 않고 그림만 훑는 사람을 위한 것이라
// 그림과 같은 폭으로 묶어 둔다.
function Caps({ children }) {
  return (
    <div className="mx-auto mb-4 grid max-w-[340px] grid-cols-2 gap-3 text-center text-[12.5px] leading-[1.45] text-[#54606F]">
      {children}
    </div>
  );
}

function CapsLabel({ children }) {
  return <b className="font-extrabold text-[#002D56]">{children}</b>;
}

const HomeScreenGuide = () => {
  return (
    <div>
      <p className="text-[14.5px] text-[#54606F]">
        스마트폰 바탕화면에 아이콘을 두면 앱처럼 한 번에 열 수 있습니다.
      </p>

      <a
        href={SITE_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-[18px] block rounded-xl bg-[#002D56] px-4 py-[14px] text-center text-base font-extrabold tracking-[-0.01em] text-white no-underline">
        studyroom.computer.hufs.ac.kr
        <small className="mt-[3px] block text-[12.5px] font-semibold text-[#9CC3E6]">
          먼저 이 주소를 브라우저에서 엽니다
        </small>
      </a>

      <DeviceCard name="Safari" platforms="아이폰 · 아이패드">
        <svg className={figureClass} viewBox="0 0 340 214" role="img" aria-label="주소창 오른쪽 점 세 개를 누른 뒤, 공유 목록에서 홈 화면에 추가를 선택합니다">
          <rect x="12" y="10" width="128" height="194" rx="18" fill="#fff" stroke="#C9D3DC" strokeWidth="2"/>
          <rect x="22" y="20" width="108" height="144" fill="#F7F5F2"/>
          <rect x="30" y="30" width="92" height="20" rx="4" fill="#002D56"/>
          <rect x="30" y="58" width="60" height="6" rx="3" fill="#D6DDE3"/>
          <rect x="30" y="70" width="86" height="6" rx="3" fill="#E2E7EB"/>
          <rect x="30" y="82" width="74" height="6" rx="3" fill="#E2E7EB"/>
          <rect x="30" y="98" width="92" height="52" rx="5" fill="#EDF1F4"/>
          {/* compact toolbar (iOS 26) */}
          <rect x="22" y="166" width="108" height="26" fill="#EFEBE6"/>
          <rect x="28" y="172" width="70" height="15" rx="7.5" fill="#fff" stroke="#DDE3E8"/>
          <text x="63" y="182.5" fontSize="7" fill="#6A7480" textAnchor="middle" fontFamily="sans-serif">studyroom.computer…</text>
          <circle cx="109" cy="179.5" r="1.9" fill="#002D56"/>
          <circle cx="115" cy="179.5" r="1.9" fill="#002D56"/>
          <circle cx="121" cy="179.5" r="1.9" fill="#002D56"/>
          <circle cx="115" cy="179.5" r="12" fill="none" stroke="#2F7DC4" strokeWidth="2.5"/>
          <circle cx="18" cy="16" r="10" fill="#2F7DC4"/>
          <text x="18" y="20" fontSize="12" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="sans-serif">1</text>
          <path d="M152 107 h30 M176 101 l6 6 -6 6" stroke="#B6BFC8" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="196" y="10" width="128" height="194" rx="18" fill="#fff" stroke="#C9D3DC" strokeWidth="2"/>
          <rect x="206" y="20" width="108" height="60" fill="#F7F5F2"/>
          <rect x="204" y="84" width="112" height="112" rx="12" fill="#fff" stroke="#DDE3E8" strokeWidth="1.5"/>
          <rect x="248" y="90" width="24" height="3" rx="1.5" fill="#CFD6DC"/>
          <rect x="214" y="102" width="46" height="6" rx="3" fill="#DDE3E8"/>
          <rect x="214" y="118" width="66" height="6" rx="3" fill="#DDE3E8"/>
          <rect x="209" y="132" width="102" height="28" rx="8" fill="#EAF2F9" stroke="#2F7DC4" strokeWidth="2"/>
          <rect x="216" y="141" width="11" height="11" rx="2.5" fill="none" stroke="#002D56" strokeWidth="1.8"/>
          <path d="M221.5 148 v-6 M219 144 l2.5 -2.5 2.5 2.5" stroke="#002D56" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
          <text x="234" y="150" fontSize="10" fontWeight="bold" fill="#002D56" fontFamily="sans-serif">홈 화면에 추가</text>
          <rect x="214" y="171" width="56" height="6" rx="3" fill="#DDE3E8"/>
          <circle cx="202" cy="16" r="10" fill="#2F7DC4"/>
          <text x="202" y="20" fontSize="12" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="sans-serif">2</text>
        </svg>
        <Caps>
          <span>
            <CapsLabel>주소창 오른쪽 ⋯</CapsLabel>
            <br />
            누르고 &apos;공유&apos; 선택
          </span>
          <span>
            <CapsLabel>목록을 아래로</CapsLabel>
            <br />
            &apos;홈 화면에 추가&apos;
          </span>
        </Caps>
        <ol className={stepsClass}>
          <li>
            <Kbd>Safari</Kbd>로 위 주소를 엽니다.
          </li>
          <li>
            주소창 <b>오른쪽</b>의 <Kbd>⋯</Kbd>를 누르고 <Kbd>공유</Kbd>를
            선택합니다.
          </li>
          <li>
            목록을 아래로 내려 <Kbd>홈 화면에 추가</Kbd>를 누릅니다.
          </li>
          <li>
            이름을 <b>세미나실 예약</b>처럼 알아보기 쉽게 고칩니다.
          </li>
          <li>
            오른쪽 위 <Kbd>추가</Kbd>를 누릅니다.
          </li>
        </ol>
        <p className={noteClass}>
          <b className="text-[#002D56]">⋯ 가 안 보인다면</b> 예전 방식의
          툴바입니다. 화면 아래(아이패드는 위)의{' '}
          <b className="text-[#002D56]">공유 버튼</b>(네모에 위 화살표)을 바로
          누르면 같은 목록이 나옵니다. 툴바 모양은{' '}
          <b className="text-[#002D56]">설정 › 앱 › Safari</b> 에서 바꿀 수
          있습니다.
        </p>
      </DeviceCard>

      <DeviceCard name="Chrome" platforms="안드로이드 · 아이폰">
        <svg className={figureClass} viewBox="0 0 340 214" role="img" aria-label="크롬 오른쪽 위 점 세 개를 누른 뒤, 메뉴에서 홈 화면에 추가를 선택합니다">
          <rect x="12" y="10" width="128" height="194" rx="18" fill="#fff" stroke="#C9D3DC" strokeWidth="2"/>
          <rect x="22" y="20" width="108" height="22" fill="#EFEBE6"/>
          <rect x="28" y="25" width="76" height="12" rx="6" fill="#fff" stroke="#DDE3E8"/>
          <text x="66" y="34" fontSize="7" fill="#6A7480" textAnchor="middle" fontFamily="sans-serif">studyroom.computer…</text>
          <circle cx="118" cy="27" r="1.9" fill="#002D56"/>
          <circle cx="118" cy="31.5" r="1.9" fill="#002D56"/>
          <circle cx="118" cy="36" r="1.9" fill="#002D56"/>
          <circle cx="118" cy="31.5" r="12" fill="none" stroke="#2F7DC4" strokeWidth="2.5"/>
          <rect x="22" y="42" width="108" height="152" fill="#F7F5F2"/>
          <rect x="30" y="52" width="92" height="20" rx="4" fill="#002D56"/>
          <rect x="30" y="80" width="60" height="6" rx="3" fill="#D6DDE3"/>
          <rect x="30" y="92" width="86" height="6" rx="3" fill="#E2E7EB"/>
          <rect x="30" y="108" width="92" height="40" rx="5" fill="#EDF1F4"/>
          <circle cx="18" cy="16" r="10" fill="#2F7DC4"/>
          <text x="18" y="20" fontSize="12" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="sans-serif">1</text>
          <path d="M152 107 h30 M176 101 l6 6 -6 6" stroke="#B6BFC8" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="196" y="10" width="128" height="194" rx="18" fill="#fff" stroke="#C9D3DC" strokeWidth="2"/>
          <rect x="206" y="20" width="108" height="174" fill="#F7F5F2"/>
          <rect x="228" y="26" width="86" height="126" rx="9" fill="#fff" stroke="#DDE3E8" strokeWidth="1.5"/>
          <rect x="238" y="40" width="44" height="6" rx="3" fill="#DDE3E8"/>
          <rect x="238" y="56" width="58" height="6" rx="3" fill="#DDE3E8"/>
          <rect x="238" y="72" width="38" height="6" rx="3" fill="#DDE3E8"/>
          <rect x="232" y="86" width="78" height="26" rx="7" fill="#EAF2F9" stroke="#2F7DC4" strokeWidth="2"/>
          <text x="271" y="103" fontSize="10" fontWeight="bold" fill="#002D56" textAnchor="middle" fontFamily="sans-serif">홈 화면에 추가</text>
          <rect x="238" y="126" width="50" height="6" rx="3" fill="#DDE3E8"/>
          <circle cx="202" cy="16" r="10" fill="#2F7DC4"/>
          <text x="202" y="20" fontSize="12" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="sans-serif">2</text>
        </svg>
        <Caps>
          <span>
            <CapsLabel>오른쪽 위 ⋮</CapsLabel>
            <br />
            누르기
          </span>
          <span>
            <CapsLabel>메뉴에서</CapsLabel>
            <br />
            &apos;홈 화면에 추가&apos;
          </span>
        </Caps>
        <ol className={stepsClass}>
          <li>
            <Kbd>Chrome</Kbd>으로 위 주소를 엽니다.
          </li>
          <li>
            <b>안드로이드</b>는 오른쪽 위 <Kbd>⋮</Kbd>, <b>아이폰</b>은{' '}
            <Kbd>공유</Kbd> 버튼을 누릅니다.
          </li>
          <li>
            <Kbd>홈 화면에 추가</Kbd>를 누릅니다. 크롬 버전에 따라{' '}
            <Kbd>설치 및 바로가기 만들기</Kbd>로 보이기도 합니다.
          </li>
          <li>
            이름을 <b>세미나실 예약</b>처럼 고치고 <Kbd>추가</Kbd>를 누릅니다.
          </li>
        </ol>
        <p className={noteClass}>
          <b className="text-[#002D56]">홈 화면에 아이콘이 안 보인다면</b>{' '}
          갤럭시 등에서는 아이콘이 홈 화면이 아니라{' '}
          <b className="text-[#002D56]">앱 서랍</b>에 먼저 생깁니다. 앱 서랍에서
          아이콘을 길게 눌러 홈 화면으로 끌어다 놓으세요.
        </p>
      </DeviceCard>

      <DeviceCard name="삼성 인터넷" platforms="갤럭시">
        <svg className={figureClass} viewBox="0 0 340 214" role="img" aria-label="삼성 인터넷 화면 오른쪽 아래 더보기를 누른 뒤, 현재 페이지 추가에서 홈 화면을 선택합니다">
          <rect x="12" y="10" width="128" height="194" rx="18" fill="#fff" stroke="#C9D3DC" strokeWidth="2"/>
          <rect x="22" y="20" width="108" height="14" rx="6" fill="#E9E4DD"/>
          <text x="76" y="30" fontSize="7.5" fill="#6A7480" textAnchor="middle" fontFamily="sans-serif">studyroom.computer…</text>
          <rect x="22" y="36" width="108" height="130" fill="#F7F5F2"/>
          <rect x="30" y="46" width="92" height="20" rx="4" fill="#002D56"/>
          <rect x="30" y="74" width="60" height="6" rx="3" fill="#D6DDE3"/>
          <rect x="30" y="86" width="86" height="6" rx="3" fill="#E2E7EB"/>
          <rect x="30" y="102" width="92" height="46" rx="5" fill="#EDF1F4"/>
          <rect x="22" y="167" width="108" height="26" fill="#EFEBE6"/>
          <path d="M38 176 l-5 5 5 5" stroke="#8C97A2" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M60 176 l5 5 -5 5" stroke="#8C97A2" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="82" y="176" width="10" height="10" rx="2" fill="none" stroke="#8C97A2" strokeWidth="1.8"/>
          <path d="M108 177 h12 M108 181 h12 M108 185 h12" stroke="#002D56" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="114" cy="181" r="12" fill="none" stroke="#2F7DC4" strokeWidth="2.5"/>
          <circle cx="18" cy="16" r="10" fill="#2F7DC4"/>
          <text x="18" y="20" fontSize="12" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="sans-serif">1</text>
          <path d="M152 107 h30 M176 101 l6 6 -6 6" stroke="#B6BFC8" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="196" y="10" width="128" height="194" rx="18" fill="#fff" stroke="#C9D3DC" strokeWidth="2"/>
          <rect x="206" y="20" width="108" height="174" fill="#F7F5F2"/>
          <rect x="204" y="96" width="112" height="100" rx="12" fill="#fff" stroke="#DDE3E8" strokeWidth="1.5"/>
          <rect x="248" y="102" width="24" height="3" rx="1.5" fill="#CFD6DC"/>
          <rect x="209" y="112" width="102" height="28" rx="8" fill="#EAF2F9" stroke="#2F7DC4" strokeWidth="2"/>
          <text x="260" y="130" fontSize="10" fontWeight="bold" fill="#002D56" textAnchor="middle" fontFamily="sans-serif">현재 페이지 추가</text>
          <rect x="216" y="152" width="46" height="6" rx="3" fill="#DDE3E8"/>
          <rect x="216" y="168" width="62" height="6" rx="3" fill="#DDE3E8"/>
          <circle cx="202" cy="16" r="10" fill="#2F7DC4"/>
          <text x="202" y="20" fontSize="12" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="sans-serif">2</text>
        </svg>
        <Caps>
          <span>
            <CapsLabel>오른쪽 아래 ≡</CapsLabel>
            <br />
            누르기 (위가 아닙니다)
          </span>
          <span>
            <CapsLabel>&apos;현재 페이지 추가&apos;</CapsLabel>
            <br />› &apos;홈 화면&apos;
          </span>
        </Caps>
        <ol className={stepsClass}>
          <li>
            <Kbd>삼성 인터넷</Kbd>으로 위 주소를 엽니다.
          </li>
          <li>
            화면 <b>오른쪽 아래</b> <Kbd>≡</Kbd>(더보기)를 누릅니다.
          </li>
          <li>
            <Kbd>현재 페이지 추가</Kbd> › <Kbd>홈 화면</Kbd>을 누릅니다.
          </li>
          <li>
            이름을 입력하고 <Kbd>추가</Kbd>를 누릅니다.
          </li>
        </ol>
      </DeviceCard>

      <div className="mt-4 rounded-[14px] border border-[#E4DFD8] bg-[#F1EEE9] px-[18px] py-[15px]">
        <h3 className="mb-[9px] text-[14.5px] font-extrabold text-[#002D56]">
          추가한 뒤 알아둘 것
        </h3>
        <ul className="m-0 grid list-disc gap-[7px] pl-[19px] text-sm text-[#33414F]">
          <li>
            아이콘을 누르면 <b>세미나실 목록 화면</b>이 바로 열립니다.
          </li>
          <li>
            Safari 에서 <b>&apos;웹 앱으로 열기&apos;</b> 를 켜면 주소창 없이
            앱처럼 열리고, 끄면 평범한 즐겨찾기가 됩니다.
          </li>
          <li>
            아이폰은 브라우저와 로그인이 따로 관리됩니다.{' '}
            <b>처음 한 번은 다시 로그인</b>해야 합니다.
          </li>
          <li>
            이름이 <b>React App</b> 등으로 뜨면 추가할 때 <b>직접 고쳐서</b>{' '}
            저장하세요.
          </li>
          <li>
            카카오톡·인스타그램 등 <b>앱 안에서 열린 브라우저</b>에는 이 메뉴가
            없습니다. Safari나 Chrome으로 다시 열어 주세요.
          </li>
          <li>
            인터넷이 연결돼야 열립니다. <b>오프라인에서는 동작하지 않습니다.</b>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default HomeScreenGuide;
