import React from 'react';
import { Check } from 'lucide-react';

// 예약 한 건의 표시 전용 카드. 인터랙티브 엘리먼트를 렌더하지 않는다 — 클릭·aria-pressed 는
// 항상 바깥 래퍼(모달의 <li> 안 버튼)가 갖는다. 선택 표시는 배경색만으로 하지 않는다
// (흰 패널 대비 크림 #F1EEE9 는 1.16:1 이고, 표에서 크림은 "예약 가능" 색이라 뜻도 반대다).
// 남색 링 + "선택됨" 글자로 색 없이도 읽히게 한다. 글자는 aria-hidden 으로 두어 래퍼의
// aria-pressed 와 이중 낭독되지 않게 한다.
// text-left 는 장식이 아니다 — 모달에서 이 카드를 감싸는 <button> 의 UA 기본
// text-align: center 를 상쇄한다. 지우면 글자가 가운데로 몰린다.
const ReservationCard = ({ room, time, state, selected = false }) => (
  <div
    className={`flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-left break-keep ${
      selected
        ? 'border-[#002D56] shadow-[0_0_0_1.5px_#002D56]'
        : 'border-gray-300'
    }`}>
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-[rgba(0,45,86,0.14)] bg-white px-2 py-0.5 text-sm font-bold text-[#002D56]">
          {room}
        </span>
        {state && <span className="text-xs text-gray-600">{state}</span>}
      </div>
      <div className="mt-1 text-sm text-gray-800">{time}</div>
    </div>
    {selected && (
      <span
        aria-hidden="true"
        className="flex flex-none items-center gap-1 text-xs font-bold text-[#002D56]">
        <Check className="h-4 w-4" />
        선택됨
      </span>
    )}
  </div>
);

export default ReservationCard;
