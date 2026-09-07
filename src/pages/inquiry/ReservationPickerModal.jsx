import React, { useEffect, useRef, useState } from 'react';
import { Modal } from 'flowbite-react';

import { modalTheme } from '../../components/modal/modalTheme';

import ReservationCard from './ReservationCard';
import {
  formatReservationTime,
  formatReservationTimeRange,
  formatRoom,
  groupByDate,
  isDisputable,
  reservationStateLabel,
  sortReservationsLatestFirst,
} from './reservationView';

export const PICKER_LOADING_MESSAGE = '예약을 불러오는 중입니다.';
export const PICKER_ERROR_MESSAGE = '예약을 불러오지 못했습니다.';
export const PICKER_STALE_MESSAGE = '최신 상태를 못 받아왔습니다.';
export const PICKER_EMPTY_MESSAGE = '예약 내역이 없습니다.';
export const PICKER_EMPTY_ATTENDANCE_HINT =
  '출석 문제인데 예약을 특정할 수 없으면 유형을 기타로 바꿔 접수해 주세요.';
export const PICKER_NO_DISPUTABLE_MESSAGE =
  '미출석으로 표시된 예약이 없습니다.';
export const FILTER_DISPUTABLE = 'disputable';
export const FILTER_ALL = 'all';
export const INITIAL_LIMIT = 5;
export const MORE_STEP = 10;

const retryButtonClass =
  'min-h-[44px] rounded-md bg-[#002D56] px-4 py-2 text-sm text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const chipClass =
  'min-h-[36px] rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const chipSelectedClass =
  'min-h-[36px] rounded-full border border-[#002D56] bg-[#002D56] px-3 text-xs font-semibold text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const moreButtonClass =
  'min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-[#002D56] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';

// 문의 폼의 "관련 예약" 선택 모달. 호출 형태는 RoomPage 의 예약 확인 모달과 같다 —
// ref + initialFocus 로 열릴 때 포커스 링을 막고, <Modal> 에 style/display 클래스를 주지
// 않으며(패널이 내용 크기로 줄어든다), size 는 테마 sizes 에 있는 '2xl' 을 명시한다.
// 분기 순서가 중요하다: 목록이 있으면 isError 여도 목록을 그린다. react-query v5 는 재조회가
// 실패하면 data 를 유지한 채 status 만 error 로 바꾸고 다음 성공 전까지 error 로 눌러앉는다 —
// 오류를 먼저 보면 손에 쥔 캐시를 버려 오프라인에서 출석 이의 접수가 막힌다.
const ReservationPickerModal = ({
  show,
  onClose,
  onPick,
  selectedId,
  reservations,
  isPending,
  isError,
  refetch,
  category,
}) => {
  const dialogRef = useRef(null);
  const [filter, setFilter] = useState(FILTER_ALL);
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  // "더 보기" 는 마지막 클릭에서 자기 자신을 언마운트한다(hiddenCount 가 0 이 된다). 그대로 두면
  // 포커스가 <body> 로 떨어져 다음 Tab 이 문서 처음부터 시작한다 — 새로 드러난 첫 카드로 옮긴다.
  const [focusCardIndex, setFocusCardIndex] = useState(null);
  const focusCardRef = useRef(null);
  useEffect(() => {
    if (focusCardIndex == null) return;
    focusCardRef.current?.focus();
    setFocusCardIndex(null);
  }, [focusCardIndex]);
  // 초기 필터는 여는 순간의 값으로 한 번 정한다. 의존성에 목록을 넣으면 응답이 뒤늦게 와서
  // 손 밑에서 목록이 갈아치워진다 — 그래서 최신 값은 ref 로 읽고 effect 는 show 만 본다.
  const latestRef = useRef({ reservations, selectedId, category });
  latestRef.current = { reservations, selectedId, category };

  // 열릴 때마다 한 번 다시 읽는다 — 예약 직후·키오스크 출석 직후의 상태를 반영한다.
  // 캐시가 있으면 그 목록을 먼저 보여 주고 응답이 오면 바뀐다.
  useEffect(() => {
    if (show) refetch();
  }, [show, refetch]);

  useEffect(() => {
    if (!show) return;
    const current = latestRef.current;
    const list = sortReservationsLatestFirst(current.reservations);
    const selected = list.find(r => r.reservationId === current.selectedId);
    const disputableCount = list.filter(r => isDisputable(r)).length;
    // 출석 이의만 미출석·처리됨으로 좁힌다. 0건이거나 선택된 예약이 그 밖이면 전체로 —
    // 선택된 카드가 안 보이면 학생이 연결이 풀렸다고 오독한다.
    const useDisputable =
      current.category === 'ATTENDANCE' &&
      disputableCount > 0 &&
      (!selected || isDisputable(selected));
    setFilter(useDisputable ? FILTER_DISPUTABLE : FILTER_ALL);
    setLimit(INITIAL_LIMIT);
  }, [show]);

  const list = sortReservationsLatestFirst(reservations);
  const disputable = list.filter(r => isDisputable(r));
  const filtered = filter === FILTER_DISPUTABLE ? disputable : list;
  // 선택된 항목이 잘린 범위 밖이면 그 항목까지 펼쳐서 연다.
  const selectedIndex = filtered.findIndex(r => r.reservationId === selectedId);
  const effectiveLimit =
    filter === FILTER_ALL
      ? Math.max(limit, selectedIndex + 1)
      : filtered.length;
  const visible = filtered.slice(0, effectiveLimit);
  const hiddenCount = filtered.length - visible.length;
  // 날짜 그룹으로 감싸도 "몇 번째 카드" 를 알아야 포커스를 옮길 수 있다.
  const indexById = new Map(
    visible.map((reservation, index) => [reservation.reservationId, index]),
  );

  const renderCard = reservation => {
    const room = formatRoom(reservation);
    const state = reservationStateLabel(reservation);
    const selected = reservation.reservationId === selectedId;
    const isFocusTarget =
      indexById.get(reservation.reservationId) === focusCardIndex;
    return (
      <li key={reservation.reservationId}>
        <button
          type="button"
          ref={isFocusTarget ? focusCardRef : undefined}
          aria-pressed={selected}
          // 날짜는 그룹 제목에만 보이지만, 낭독에는 날짜가 있어야 어느 날 예약인지 안다.
          aria-label={`${formatReservationTime(reservation)} ${room} ${state}`}
          onClick={() => {
            onPick(reservation);
            onClose();
          }}
          className="min-h-[44px] w-full rounded-md focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]">
          <ReservationCard
            room={room}
            time={formatReservationTimeRange(reservation)}
            state={state}
            selected={selected}
          />
        </button>
      </li>
    );
  };

  let body;
  if (isPending) {
    body = (
      <p className="py-6 text-center text-sm text-gray-500">
        {PICKER_LOADING_MESSAGE}
      </p>
    );
  } else if (list.length > 0) {
    body = (
      <>
        {isError && (
          <div
            role="status"
            aria-live="polite"
            className="mb-3 flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span>{PICKER_STALE_MESSAGE}</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline">
              다시 시도
            </button>
          </div>
        )}
        <div role="group" aria-label="예약 필터" className="mb-3 flex gap-2">
          <button
            type="button"
            aria-pressed={filter === FILTER_DISPUTABLE}
            onClick={() => setFilter(FILTER_DISPUTABLE)}
            className={
              filter === FILTER_DISPUTABLE ? chipSelectedClass : chipClass
            }>
            미출석·처리됨 {disputable.length}
          </button>
          <button
            type="button"
            aria-pressed={filter === FILTER_ALL}
            onClick={() => setFilter(FILTER_ALL)}
            className={filter === FILTER_ALL ? chipSelectedClass : chipClass}>
            전체 {list.length}
          </button>
        </div>
        {/* 기타 문의에서 이 칩을 직접 눌러도 빈 목록만 남지 않게, 필터가 걸렸으면 같이 안내한다. */}
        {disputable.length === 0 &&
          (category === 'ATTENDANCE' || filter === FILTER_DISPUTABLE) && (
            <p className="mb-3 text-sm text-gray-600 break-keep">
              {PICKER_NO_DISPUTABLE_MESSAGE}
            </p>
          )}
        <ul className="space-y-3">
          {groupByDate(visible).map(group => (
            <li key={group.key}>
              <h3 className="mb-1 text-xs font-semibold text-gray-600">
                {group.heading}
              </h3>
              <ul className="space-y-2">{group.items.map(renderCard)}</ul>
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => {
                // 화면에 실제 적용된 개수(effectiveLimit)를 기준으로 늘린다. limit 만 올리면
                // 선택 항목까지 펼쳐진 상태에서는 첫 클릭이 아무것도 늘리지 못한다.
                setLimit(effectiveLimit + MORE_STEP);
                setFocusCardIndex(effectiveLimit);
              }}
              className={moreButtonClass}>
              더 보기 ({Math.min(hiddenCount, MORE_STEP)}건)
            </button>
          </div>
        )}
      </>
    );
  } else if (isError) {
    body = (
      <div className="py-6 text-center text-sm text-gray-500">
        {PICKER_ERROR_MESSAGE}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => refetch()}
            className={retryButtonClass}>
            다시 시도
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="py-6 text-center text-sm text-gray-500 break-keep">
        <p>{PICKER_EMPTY_MESSAGE}</p>
        {category === 'ATTENDANCE' && (
          <p className="mt-2">{PICKER_EMPTY_ATTENDANCE_HINT}</p>
        )}
      </div>
    );
  }

  return (
    <Modal
      ref={dialogRef}
      initialFocus={dialogRef}
      className="flex items-center justify-center"
      theme={modalTheme}
      size="2xl"
      dismissible
      show={show}
      onClose={onClose}>
      <Modal.Header>예약 선택</Modal.Header>
      <Modal.Body>
        {/* 공용 테마의 body 는 pb-0 이고 그 아래 여백은 footer 가 만드는데 이 모달에는
            footer 가 없다. 마지막 카드가 패널의 둥근 모서리에 붙지 않게 여기서 준다. */}
        <div className="pb-5">{body}</div>
      </Modal.Body>
    </Modal>
  );
};

export default ReservationPickerModal;
