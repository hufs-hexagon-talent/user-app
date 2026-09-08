import React, { useEffect, useRef, useState } from 'react';
import { Modal } from 'flowbite-react';

import { modalTheme } from '../../components/modal/modalTheme';

import { retryState } from './inquiryView';
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
export const DISPUTABLE_SECTION_TITLE = '출석 문제가 있는 예약';
export const OTHER_SECTION_TITLE = '그 밖의 예약';
export const INITIAL_LIMIT = 6;
export const MORE_STEP = 6;

const retryButtonClass =
  'min-h-[44px] rounded-md bg-[#002D56] px-4 py-2 text-sm text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';
const moreButtonClass =
  'min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-[#002D56] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]';

// 문의 폼의 "관련 예약" 선택 모달. 호출 형태는 RoomPage 의 예약 확인 모달과 같다 —
// ref + initialFocus 로 열릴 때 포커스 링을 막고, <Modal> 에 style/display 클래스를 주지
// 않으며(패널이 내용 크기로 줄어든다), size 는 테마 sizes 에 있는 '2xl' 을 명시한다.
// 분기 순서가 중요하다: 목록이 있으면 isError 여도 목록을 그린다. react-query v5 는 재조회가
// 실패하면 data 를 유지한 채 status 만 error 로 바꾸고 다음 성공 전까지 error 로 눌러앉는다 —
// 오류를 먼저 보면 손에 쥔 캐시를 버려 오프라인에서 출석 이의 접수가 막힌다.
// 좁히기(필터 칩)는 두지 않는다. 목록 길이는 6건 캡 + "더 보기" 가 잡고, "학생이 찾는 예약을
// 위로" 는 구획이 잡는다. 칩 두 개(전체 ⊃ 미출석)는 상호배타가 아니라 aria-pressed 로밖에
// 못 그렸고, 기본값이 조건 세 개로 뒤집혀 학생이 이유를 알 수 없었다.
const ReservationPickerModal = ({
  show,
  onClose,
  onPick,
  selectedId,
  reservations,
  isPending,
  isError,
  isFetching = false,
  isPaused = false,
  refetch,
  category,
}) => {
  // 모달은 열릴 때마다 재조회하므로 이 배너는 목록·상세보다 자주 뜬다. 진행 중에는 잠근다.
  const retry = retryState({ isFetching, isPaused });
  const dialogRef = useRef(null);
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
  // 열릴 때마다 한 번 다시 읽는다 — 예약 직후·키오스크 출석 직후의 상태를 반영한다.
  // 캐시가 있으면 그 목록을 먼저 보여 주고 응답이 오면 바뀐다.
  useEffect(() => {
    if (show) refetch();
  }, [show, refetch]);

  useEffect(() => {
    if (show) setLimit(INITIAL_LIMIT);
  }, [show]);

  const list = sortReservationsLatestFirst(reservations);
  const disputable = list.filter(r => isDisputable(r));
  // 판정을 한 번만 하고 id 로 나눈다. isDisputable 은 now 를 기본값으로 받으므로 렌더 중에
  // 여러 번 부르면 종료 시각 경계에 걸친 예약이 두 구획 사이에서 흔들릴 수 있다.
  const disputableIds = new Set(disputable.map(r => r.reservationId));
  // 출석 이의는 학생이 찾는 예약이 사실상 정해져 있다. 필터로 숨기는 대신 맨 위로 올린다 —
  // 숨기면 "내 예약이 없어졌다" 오독이 생기고, 기본 필터가 언제 뒤집히는지 학생이 알 수 없다.
  const hasSections = category === 'ATTENDANCE' && disputable.length > 0;
  const ordered = hasSections
    ? [...disputable, ...list.filter(r => !disputableIds.has(r.reservationId))]
    : list;
  // 선택된 항목이 잘린 범위 밖이면 그 항목까지 펼쳐서 연다.
  const selectedIndex = ordered.findIndex(r => r.reservationId === selectedId);
  const effectiveLimit = Math.max(limit, selectedIndex + 1);
  const visible = ordered.slice(0, effectiveLimit);
  const hiddenCount = ordered.length - visible.length;
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

  // 모달 제목이 h3(flowbite Modal.Header 기본값)이라 구획은 h4, 그 안의 날짜는 h5 다.
  // 구획이 없으면 날짜가 제목 바로 아래 단계이므로 h4 로 올린다.
  const renderDateGroups = (items, DateHeading) => (
    <ul className="space-y-3">
      {groupByDate(items).map(group => (
        <li key={group.key}>
          <DateHeading className="mb-1 text-xs font-semibold text-gray-600">
            {group.heading}
          </DateHeading>
          <ul className="space-y-2">{group.items.map(renderCard)}</ul>
        </li>
      ))}
    </ul>
  );

  const visibleDisputable = visible.filter(r =>
    disputableIds.has(r.reservationId),
  );
  const visibleOther = visible.filter(r => !disputableIds.has(r.reservationId));

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
              disabled={retry.disabled}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline">
              {retry.label}
            </button>
          </div>
        )}
        {/* 출석 이의인데 대상이 하나도 없으면 왜 안 보이는지 알려 준다. 구획은 그리지 않는다. */}
        {disputable.length === 0 && category === 'ATTENDANCE' && (
          <p className="mb-3 text-sm text-gray-600 break-keep">
            {PICKER_NO_DISPUTABLE_MESSAGE}
          </p>
        )}
        {hasSections ? (
          <div className="space-y-4">
            {visibleDisputable.length > 0 && (
              <section aria-labelledby="picker-disputable-heading">
                <h4
                  id="picker-disputable-heading"
                  className="mb-2 text-sm font-bold text-black">
                  {DISPUTABLE_SECTION_TITLE} {disputable.length}건
                </h4>
                {renderDateGroups(visibleDisputable, 'h5')}
              </section>
            )}
            {visibleOther.length > 0 && (
              <section aria-labelledby="picker-other-heading">
                <h4
                  id="picker-other-heading"
                  className="mb-2 text-sm font-bold text-black">
                  {OTHER_SECTION_TITLE}
                </h4>
                {renderDateGroups(visibleOther, 'h5')}
              </section>
            )}
          </div>
        ) : (
          renderDateGroups(visible, 'h4')
        )}
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
