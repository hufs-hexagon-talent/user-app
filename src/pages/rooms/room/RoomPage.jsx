import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker, { registerLocale } from 'react-datepicker';
import { Typography } from '@mui/material';
import {
  addDays,
  addMinutes,
  format,
  isBefore,
  isSameDay,
  differenceInMinutes,
} from 'date-fns';

import Banner from '../../admin/banner/Banner';
import { ko } from 'date-fns/locale';
import { useSnackbar } from 'react-simple-snackbar';
import 'react-datepicker/dist/react-datepicker.css';
import { fetchDate } from '../../../api/policySchedule.api';
import { useReservations, useReserve } from '../../../api/reservation.api';
import useUrlQuery from '../../../hooks/useUrlQuery';
import useAuth from '../../../hooks/useAuth';
import { fetchBlockedPeriod, isAuthError } from '../../../api/user.api';
import {
  getReserveErrorMessage,
  hasReservedSlotInRange,
  maxMinutesExceededMessage,
  normalizeErrorCode,
  RESERVE_AUTH_FAILED_MESSAGE,
} from './reservationSlot';
import ReservationTimeTable from './ReservationTimeTable';
import { buildSlots, dayStartOf, isSlotClosedForRoom } from './operationWindow';
import { getSlotState } from './slotState';
import TimeTableLegend from './TimeTableLegend';
import { LEGEND_GUTTER_CLASS } from './tableGutter';
import SelectionBar from './SelectionBar';
import CustomButton from '../../../components/button/Button';
import { Button } from 'flowbite-react';
import { Modal } from 'flowbite-react';
import { durationLabel } from './durationLabel';
import {
  dayOfMonthLabel,
  monthDayLabel,
  shortDateLabel,
  weekdayDateLabel,
} from './dateLabel';
import { modalTheme } from '../../../components/modal/modalTheme';
import BooEmptyState from '../../../components/BooEmptyState';
import { clockLabel, endTimeParts } from '../../../utils/reservationTimeLabel';

// 취소·예약 버튼(flowbite Button, node_modules/flowbite-react/dist/esm/components/Button/theme.mjs)
// 의 색은 theme.color 를 통째로 바꾼다 — className 으로 hover 색만 덧붙이면 theme.color.light/
// dark 기본 문자열에 남아 있는 dark:bg-gray-600 등 다크모드 클래스가 지워지지 않고 그대로
// 남는다(className 은 twMerge 순서상 맨 뒤라 같은 성질끼리만 덮어쓴다). 이 디자인은 다크모드가
// 없으므로 색 문자열 자체를 다크 변형 없이 새로 준다. 크기(50px·16px 반경 등)는 다크모드와
// 무관해 className 에 둔다.
// inner.base 기본값: "flex items-stretch transition-all duration-200" — 안쪽 <span> 을 버튼
// 정중앙에 놓도록 h-full/w-full/items-center/justify-center 로 바꾼다.
// size.md 기본값: "px-4 py-2 text-sm" — d5.css 의 padding:0, font-size:15px, font-weight:700,
// line-height:1 로 바꾼다(letter-spacing 은 바깥 button 클래스에 두면 상속되어 span 에도
// 적용된다).
const reserveActionButtonTheme = {
  color: {
    light:
      'border border-[#D9D4CD] bg-white text-[#39434F] shadow-none enabled:hover:border-[#CBC5BD] enabled:hover:bg-[#F7F5F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]',
    dark: 'border-0 bg-[#002D56] text-white shadow-[0_8px_18px_-9px_rgba(0,45,86,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] enabled:hover:bg-[#013C6E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]',
  },
  inner: {
    base: 'flex h-full w-full items-center justify-center',
  },
  size: {
    md: 'p-0 text-[15px] font-bold leading-none',
  },
};

const RoomPage = () => {
  // snackBar
  const [openSnackbar, closeSnackbar] = useSnackbar({
    position: 'top-right',
    style: {
      backgroundColor: '#FF3333',
    },
  });

  // react-simple-snackbar 는 매 렌더 새 함수를 돌려준다. 그대로 의존성에 넣으면
  // 아래 useCallback 들이 매번 새로 만들어져 표의 memo 가 무력해진다.
  const openSnackbarRef = useRef(openSnackbar);
  openSnackbarRef.current = openSnackbar;
  const showSnackbar = useCallback(message => {
    openSnackbarRef.current(message);
  }, []);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedRangeFrom, setSelectedRangeFrom] = useState(null);
  const [selectedRangeTo, selSelectedRangeTo] = useState(null);
  // null 은 "달력 제한 없음". 응답 전·조회 실패·목록이 빈 경우 모두 null 로 둔다.
  // 빈 배열을 그대로 includeDates 에 주면 react-datepicker 가 "허용 날짜 0개" 로 읽어
  // 35칸이 전부 잠기고 월 이동 화살표까지 사라져 학생이 아무것도 할 수 없다.
  const [availableDate, setAvailableDate] = useState(null);
  const [openReserveModal, setOpenReserveModal] = useState(false);
  // 모달이 열리며 닫기 버튼에 자동 포커스가 가면 마우스 사용자에게도 focus-visible 링이
  // 보인다(flowbite Modal 이 FloatingFocusManager 로 initialFocus 대상에 포커스를 준다).
  // 대신 대화상자 컨테이너(role="dialog")를 initialFocus 로 지정한다 — WAI-ARIA APG 권장
  // 방식이고, 스크린리더는 aria-labelledby 로 제목을 읽으므로 안내가 끊기지 않는다.
  const reserveDialogRef = useRef(null);

  const navigate = useNavigate();
  const today = new Date();
  const departmentId = 1;

  // 화면을 열어둔 채 시간이 지나면 지난 칸이 저절로 잠기도록 현재 시각을 갱신한다
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // 주소에 date 가 없을 때 보여 줄 날. 자정이 지나면 오늘로 넘긴다(아래 effect).
  // 날짜를 주소로 고정했으면 이 값은 쓰이지 않는다.
  const todayDate = format(now, 'yyyy-MM-dd');
  const [followDate, setFollowDate] = useState(todayDate);

  const [selectedDate, setSelectedDate, isDateFixed] = useUrlQuery(
    'date',
    followDate,
  );

  const { mutateAsync: doReserve, isPending: isReserving } = useReserve();
  // isPending 은 다음 렌더에서야 true 가 되어 같은 tick 의 두 번째 클릭을 막지 못한다.
  // 실제 차단은 동기 래치가 한다.
  const reservingRef = useRef(false);
  const {
    data: reservationsByRooms,
    isPending: isReservationsPending,
    isError: isReservationsError,
    refetch: refetchReservations,
  } = useReservations({
    date: selectedDate,
    departmentId: departmentId,
  });
  const { loggedIn: isLoggedIn } = useAuth();

  // 분기 순서: 표가 손에 있으면 isError 여도 표를 그린다 — react-query v5 는 재조회가 실패해도
  // data 를 유지한다. 30초 폴링이나 앱 복귀 재조회가 한 번 실패했다고 표를 오류 카드로 바꾸면
  // 모바일은 유일한 예약 버튼(SelectionBar)까지 사라진다(MyInquiries 의 hasList 와 같은 규칙).
  const hasReservationData =
    !isReservationsPending && Array.isArray(reservationsByRooms);
  const hasRooms = hasReservationData && reservationsByRooms.length > 0;

  // 선택해 둔 첫 칸이 시간이 지나 잠기면 선택을 푼다. 잠긴 칸을 예약하려다 실패하는 일을 막는다.
  // 확인 모달이 열려 있으면 미룬다. 23:58 에 연 23:30~익일 01:00 모달이 자정 뒤에 빈 시각으로 바뀌지
  // 않게 한다(서버는 끝이 지금보다 뒤인지만 보므로 이 예약을 받는다). 모달을 닫으면 다시 본다.
  useEffect(() => {
    if (!selectedRangeFrom || openReserveModal) return;
    if (now > addMinutes(selectedRangeFrom, 30)) {
      setSelectedRoom(null);
      setSelectedRangeFrom(null);
      selSelectedRangeTo(null);
    }
  }, [now, selectedRangeFrom, openReserveModal]);

  // 자정이 지나면 주소에 date 가 없는 화면을 오늘 표로 넘긴다. 고르던 칸이 있거나 확인 모달이 열려
  // 있으면 미룬다. 첫 칸이 지나 선택이 풀리면(위 effect) 그때 넘어간다.
  useEffect(() => {
    if (followDate === todayDate) return;
    if (openReserveModal || selectedRangeFrom) return;
    setFollowDate(todayDate);
  }, [todayDate, followDate, openReserveModal, selectedRangeFrom]);

  // 날짜 변경 시 기존 선택 초기화.
  // 예약 현황은 30초마다 다시 불러오므로 조회 결과가 아니라 날짜에만 반응해야
  // 남이 예약하는 순간 학생이 고르던 칸이 풀리지 않는다.
  useEffect(() => {
    setSelectedRoom(null);
    setSelectedRangeFrom(null);
    selSelectedRangeTo(null);
  }, [selectedDate]);

  // 표의 칸 목록은 응답에서 바로 만든다. effect 로 범위를 state 에 옮겨 두면 한 렌더 늦어서
  // 날짜를 바꾼 첫 렌더가 이전 날의 범위로 그려진다. 칸마다 분과 절대 시각을 함께 갖는다.
  const slots = useMemo(
    () => buildSlots(reservationsByRooms, selectedDate),
    [reservationsByRooms, selectedDate],
  );
  const dayStart = useMemo(() => dayStartOf(selectedDate), [selectedDate]);

  // 익일 꼬리가 있는 날에는 표 아래에 다음 날 표로 가는 링크를 둔다. 이 표는 다음 날을 overnightUntil 까지만 보여 준다.
  const nextDayStart =
    dayStart && slots.some(slot => slot.nextDay) ? addDays(dayStart, 1) : null;

  // 주소로 고정한 날짜가 지난 날이 된 경우. 화면을 열어 둔 사이 자정이 지난 때뿐 아니라, 자정 뒤에
  // 브라우저가 탭을 다시 불러온 때도 띄운다. 달력은 오늘부터 고르므로 지난 날짜는 옛 주소에서만 생긴다.
  const showDateChanged = isDateFixed === true && selectedDate < todayDate;

  // 오늘 표에 새로 고를 수 있는 칸이 하나도 남지 않았는지. 꼬리 칸은 눌러서 고를 수 있지만 다음 날에 시작하는
  // 예약이라 세지 않는다. 꼬리만 비어 있으면 오늘 예약할 수 있는 시간은 끝났다.
  const noSlotLeftToday = useMemo(() => {
    if (selectedDate !== todayDate || !hasRooms) return false;
    return !reservationsByRooms.some(room =>
      slots.some(
        slot =>
          !slot.nextDay &&
          getSlotState({
            slotStart: slot.startAt,
            slotMinute: slot.startMinute,
            now,
            room,
            selection: null,
          }).selectable,
      ),
    );
  }, [selectedDate, todayDate, hasRooms, reservationsByRooms, slots, now]);

  // 오늘 뒤의 첫 운영일('yyyy-MM-dd'). 예약 가능한 날짜 목록을 모르면 null 이다.
  const nextOpenDate = useMemo(() => {
    if (!Array.isArray(availableDate)) return null;
    const later = availableDate
      .map(date => format(date, 'yyyy-MM-dd'))
      .filter(date => date > todayDate)
      .sort();
    return later[0] ?? null;
  }, [availableDate, todayDate]);
  const nextOpenLabel =
    nextOpenDate &&
    (nextOpenDate === format(addDays(now, 1), 'yyyy-MM-dd')
      ? '내일 표 보기'
      : `${weekdayDateLabel(dayStartOf(nextOpenDate))} 표 보기`);

  // date-picker에서 날짜 선택할 때마다 실행되는 함수
  const handleDateChange = date => {
    // 입력칸을 비우면 onChange(null) 이 온다. format(null) 은 RangeError 를 던진다.
    if (!date) return;
    const formattedDate = format(date, 'yyyy-MM-dd');
    // date picker에서 선택한 날짜 저장
    setSelectedDate(formattedDate);
  };

  // 슬롯의 상태 토글하는 함수
  // 익일 꼬리 칸도 보통 칸과 같은 규칙으로 고른다. 꼬리 칸을 먼저 누르거나 남의 예약을 건너 누르면 거기서
  // 새 선택이 시작되고, 그 예약은 다음 날(D+1)에 시작한다. 꼬리 칸은 그 호실의 overnightUntil 까지만
  // 열려 있어서(operationWindow) 이 표에서 고르는 끝도 거기까지다.
  const toggleSlot = useCallback(
    (partition, slot) => {
      const targetStartAt = slot.startAt;
      const targetEndAt = slot.endAt;

      const isFirstSelect = !selectedRangeFrom && !selectedRangeTo;
      // 예약 현황은 30초마다 다시 불러온다. 남이 예약하면 그 방 객체만 새 참조로 바뀌므로
      // 객체를 그대로 비교하면 고르던 칸이 연장되지 않고 새 선택으로 접힌다. 식별자로 비교한다.
      const isSameRoom =
        !!selectedRoom && selectedRoom.partitionId === partition.partitionId;
      const isDifferentRoom = !isSameRoom;

      const isSelectPast = isBefore(targetStartAt, selectedRangeFrom);
      // 최대 길이는 이 표 응답에 실린 그 호실의 eachMaxMinute 로 잰다. 꼬리 칸에서 시작한 선택은 서버가
      // 다음 날 예약으로 보고 다음 날 정책의 최대 시간으로 판정한다. 꼬리가 붙는 날은 시험 기간 일정 안이라
      // 두 날의 정책이 같아 어긋나지 않는다. 어긋나면 서버가 RESERVATION-006 으로 거절하고
      // handleReservation 의 오류 안내가 뜬다.
      const isOverDue =
        differenceInMinutes(targetEndAt, selectedRangeFrom) >
        selectedRoom?.eachMaxMinute;

      if (
        isSameRoom &&
        selectedRangeFrom?.getTime() === targetStartAt.getTime() &&
        selectedRangeTo?.getTime() === targetEndAt.getTime()
      ) {
        setSelectedRoom(null);
        setSelectedRangeFrom(null);
        selSelectedRangeTo(null);
        return;
      }

      // 새롭게 시간을 선택함
      if (isFirstSelect || isDifferentRoom || isSelectPast) {
        setSelectedRoom(partition);
        setSelectedRangeFrom(targetStartAt);
        selSelectedRangeTo(targetEndAt);
        return;
      }

      // 연장 범위 안에 남의 예약이 있으면 건너뛰지 않고 클릭한 칸부터 새로 선택한다.
      // 남의 예약을 가로지르는 범위는 연장이 될 수 없으니 최대 시간 검사보다 먼저 본다.
      if (
        hasReservedSlotInRange(
          partition.reservationTimeRanges,
          selectedRangeFrom,
          targetEndAt,
        )
      ) {
        setSelectedRoom(partition);
        setSelectedRangeFrom(targetStartAt);
        selSelectedRangeTo(targetEndAt);
        return;
      }

      // 최대 예약 시간을 넘는 연장은 안내만 하고 선택은 그대로 둔다
      if (isOverDue) {
        showSnackbar(maxMinutesExceededMessage(selectedRoom?.eachMaxMinute));
        return;
      }

      // 시간을 연장함
      setSelectedRoom(partition);
      selSelectedRangeTo(targetEndAt);
    },
    [
      setSelectedRangeFrom,
      selSelectedRangeTo,
      selectedRoom,
      selectedRangeFrom,
      selectedRangeTo,
      showSnackbar,
    ],
  );

  // 자신의 예약 생성
  const handleReservation = useCallback(
    async ({ roomPartitionId, startDateTime, endDateTime }) => {
      if (reservingRef.current) return;
      if (!isLoggedIn) {
        openSnackbar('로그인 후에 세미나실 예약이 가능합니다.');
        setTimeout(() => {
          closeSnackbar();
          navigate('/login');
        }, 5000);
        return;
      }
      if (!selectedRoom || !selectedRangeFrom || !selectedRangeTo) {
        openSnackbar(
          '원하는 호실과 시간대를 선택하고 예약하기 버튼을 눌러주세요',
        );
        setTimeout(() => {
          closeSnackbar();
        }, 5000);
        return;
      }
      // 요청이 끝나기 전에 다시 누르면 같은 예약이 두 번 전송된다
      if (reservingRef.current) return;
      reservingRef.current = true;
      try {
        await doReserve({
          roomPartitionId,
          startDateTime,
          endDateTime,
        });
        navigate('/check');
      } catch (error) {
        // 인터셉터가 세션 만료로 확정한 경우만 SessionExpiryWatcher 가 안내한다.
        // 그 밖의 인증 오류(403 권한 없음 등)는 인터셉터가 손대지 않으므로 여기서 안내한다.
        if (error?.sessionExpired) return;
        if (isAuthError(error)) {
          openSnackbar(RESERVE_AUTH_FAILED_MESSAGE);
          return;
        }

        const status = error?.response?.status;
        const code = normalizeErrorCode(error?.response?.data?.code);

        // 노쇼 차단이면 해제일을 조회해 문구에 넣는다. 조회에 실패해도 안내는 한다
        let blockedUntil = null;
        if (code === 'RESERVATION-004') {
          try {
            const blocked = await fetchBlockedPeriod();
            blockedUntil = blocked?.data?.endBlockedDate ?? null;
          } catch {
            blockedUntil = null;
          }
        }

        openSnackbar(getReserveErrorMessage(code, { blockedUntil }));

        // 업무 규칙에 걸린 선택은 그대로 두면 같은 실패가 반복된다
        if (status === 412) {
          setSelectedRoom(null);
          setSelectedRangeFrom(null);
          selSelectedRangeTo(null);
        }
      } finally {
        reservingRef.current = false;
      }
    },
    [doReserve, isLoggedIn, selectedRoom, selectedRangeFrom, selectedRangeTo],
  );

  const openReserveConfirm = () => {
    if (isReserving) return;
    if (selectedRoom && selectedRangeFrom && selectedRangeTo) {
      setOpenReserveModal(true);
    } else {
      showSnackbar('원하는 호실과 시간대를 선택해주세요.');
    }
  };

  // 최대 예약 시간에 부합하는지 계산하는 함수
  const handleCellClick = useCallback(
    (partition, timeIndex) => {
      const slot = slots[timeIndex];
      if (!slot) return;

      // 갱신 주기 사이에 지나가 버린 칸이 눌리지 않게 클릭 시점으로 한 번 더 확인한다
      const clickedAt = new Date();
      if (clickedAt > slot.endAt) {
        setNow(clickedAt);
        return;
      }

      // 표의 공통 범위가 아니라 방별 운영시간(익일 꼬리 포함)으로 검사한다
      const isClosed = isSlotClosedForRoom(
        partition,
        slot.startMinute,
        dayStart,
      );

      if (!isClosed) {
        toggleSlot(partition, slot);
      }
    },
    [slots, toggleSlot, dayStart],
  );

  const handleSlotClick = useCallback(
    (room, timeIndex, state) => {
      if (!state.selectable) return;
      handleCellClick(room, timeIndex);
    },
    [handleCellClick],
  );

  // 매 렌더 새 객체를 만들면 표에 넘기는 selection prop 이 계속 바뀌어 표의 memo 가 무력해진다.
  const selection = useMemo(
    () =>
      selectedRoom && selectedRangeFrom && selectedRangeTo
        ? {
            partitionId: selectedRoom.partitionId,
            from: selectedRangeFrom,
            to: selectedRangeTo,
          }
        : null,
    [selectedRoom, selectedRangeFrom, selectedRangeTo],
  );

  // 꼬리 칸에서 시작한 선택은 표의 날짜가 아니라 다음 날에 시작한다. 하단 바는 평소 날짜를 적지 않으므로
  // 이때만 시각 앞에 시작일을 붙인다. 없으면 '00:00~01:30' 이 이 표의 새벽으로 읽힌다.
  const selectionDateLabel =
    selectedRangeFrom && dayStart && !isSameDay(selectedRangeFrom, dayStart)
      ? monthDayLabel(selectedRangeFrom)
      : null;

  // 예약 확인 모달의 타임레일에 쓰는 값. 순수 함수 결과라 useMemo 는 필요 없다.
  // 날짜는 표의 날짜가 아니라 선택한 예약이 시작하는 날이다. 끝은 공용 표기라 자정이면 '24:00' 이다.
  // 자정을 넘으면 윗줄에 끝나는 날을 화살표로 잇고, 종료 시각은 그날의 시각으로 적고 캡션에 날을 붙인다.
  // 24:00 에 끝나면 날짜 흐름·캡션·안내를 붙이지 않는다. 꼬리 칸에서 시작한 선택은 시작과 끝이 모두
  // 다음 날 안이라 그날 날짜를 적고 끝도 같은 날 시각('01:30')으로 적는다. 날짜 흐름·캡션·안내는 없다.
  const modalEnd =
    selectedRangeFrom && selectedRangeTo
      ? endTimeParts(selectedRangeFrom, selectedRangeTo)
      : null;
  const modalCrossesMidnight = modalEnd?.nextDay === true;
  const modalDateLabel = shortDateLabel(selectedRangeFrom ?? selectedDate);
  const modalEndDateLabel = modalCrossesMidnight
    ? shortDateLabel(selectedRangeTo)
    : null;
  const modalFromLabel = selectedRangeFrom ? clockLabel(selectedRangeFrom) : '';
  const modalToLabel = modalEnd ? modalEnd.time : '';
  const modalEndCaption = modalCrossesMidnight
    ? `종료 · ${dayOfMonthLabel(selectedRangeTo)}`
    : '종료';
  const modalDurationText =
    selectedRangeFrom && selectedRangeTo
      ? durationLabel(differenceInMinutes(selectedRangeTo, selectedRangeFrom))
      : '';
  // 타임레일은 시각 표현이라 시작/종료 라벨과 점선이 스크린리더에 조각으로 읽힌다.
  // 블록 전체를 한 문장으로 읽도록 aria-label 을 만든다.
  const modalTimeAriaLabel =
    modalFromLabel && modalToLabel
      ? `${modalDateLabel} ${modalFromLabel}부터 ${
          modalEndDateLabel ? `${modalEndDateLabel} ` : ''
        }${modalToLabel}까지${modalDurationText ? `, ${modalDurationText}` : ''}`
      : '';

  // date-picker 설정
  registerLocale('ko', ko);

  // 현재로부터 예약 가능한 방들의 날짜 목록 가져오기
  useEffect(() => {
    const getDate = async () => {
      try {
        const dates = await fetchDate(departmentId);
        const hasDates = Array.isArray(dates) && dates.length > 0;
        setAvailableDate(hasDates ? dates : null);
      } catch {
        // 목록이 비어 있으면 달력의 모든 날짜가 잠기므로 제한을 풀고 안내한다
        setAvailableDate(null);
        openSnackbar(
          '예약 가능한 날짜를 불러오지 못했습니다. 달력에서 날짜를 직접 골라 주세요.',
        );
      }
    };
    getDate();
  }, []);

  return (
    <>
      <div id="container">
        <div id="head-container">
          <Typography
            marginTop="50px"
            variant="h5"
            fontWeight={450}
            component="div"
            align="center">
            일자별 세미나실 예약 현황
          </Typography>
          <div
            id="text"
            className="mt-5 mx-3 justify-center text-center break-keep"
            style={{ color: '#9D9FA2' }}>
            아래 예약 현황의 예약가능 시간을 선택하면 해당 세미나실을 예약하여
            사용할 수 있습니다.
          </div>
          {/* 배너 */}
          <Banner />
          {/* date-picker 부분 */}
          <div className="flex justify-center">
            <div id="datepicker-container">
              <DatePicker
                id="date"
                className={'text-center flex'}
                selected={selectedDate}
                locale={ko}
                minDate={today}
                includeDates={availableDate}
                // 허용 날짜가 이번 달에 없어도 화살표는 남긴다(비활성 표시). 화살표까지 사라지면
                // 고장 난 화면으로 보인다.
                showDisabledMonthNavigation
                onChange={handleDateChange}
                dateFormat="yyyy년 MM월 dd일"
                showIcon
              />
            </div>
          </div>
        </div>
        {hasRooms && isReservationsError && (
          <div
            role="status"
            aria-live="polite"
            className="mx-8 md:mx-12 lg:mx-96 mb-2 flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span>
              최신 예약 현황을 못 받아왔습니다. 표시된 내용이 실제와 다를 수
              있습니다.
            </span>
            <button
              type="button"
              onClick={() => refetchReservations()}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline">
              다시 시도
            </button>
          </div>
        )}
        {showDateChanged && (
          <div
            role="status"
            aria-live="polite"
            className="mx-8 md:mx-12 lg:mx-96 mb-2 flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span>날짜가 바뀌었어요.</span>
            <button
              type="button"
              // 주소의 날짜를 지우면 오늘을 따라가는 화면으로 돌아간다
              onClick={() => setSelectedDate('')}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline">
              오늘 표 보기
            </button>
          </div>
        )}
        {noSlotLeftToday && nextOpenDate && (
          <div
            role="status"
            aria-live="polite"
            className="mx-8 md:mx-12 lg:mx-96 mb-2 flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span>오늘 예약할 수 있는 시간이 끝났어요.</span>
            <button
              type="button"
              onClick={() => setSelectedDate(nextOpenDate)}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-bold text-[#002D56] hover:underline">
              {nextOpenLabel}
              <span aria-hidden="true">&nbsp;›</span>
            </button>
          </div>
        )}
        {hasRooms && <TimeTableLegend />}
        {/* timeTable 시작 */}
        {isReservationsPending && (
          <div className="text-center mx-8 md:mx-12 lg:mx-96 py-12 my-12 rounded-lg bg-gray-100 text-gray-900">
            예약 현황을 불러오는 중입니다.
          </div>
        )}
        {!isReservationsPending && !hasRooms && isReservationsError && (
          <div className="text-center mx-8 md:mx-12 lg:mx-96 py-12 my-12 rounded-lg bg-gray-100 text-gray-900">
            예약 현황을 불러오지 못했습니다.
            <div className="mt-4 flex justify-center">
              <Button
                size="sm"
                color="dark"
                onClick={() => refetchReservations()}>
                다시 시도
              </Button>
            </div>
          </div>
        )}
        {hasRooms && slots.length > 0 && (
          <div>
            <ReservationTimeTable
              rooms={reservationsByRooms}
              slots={slots}
              selectedDate={selectedDate}
              now={now}
              selection={selection}
              onCellClick={handleSlotClick}
            />
            {nextDayStart && (
              <div className={`flex justify-end ${LEGEND_GUTTER_CLASS}`}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate(format(nextDayStart, 'yyyy-MM-dd'))
                  }
                  className="inline-flex min-h-[44px] items-center text-sm font-bold text-[#002D56] hover:underline">
                  {`${weekdayDateLabel(nextDayStart)} 표 보기`}
                  <span aria-hidden="true">&nbsp;›</span>
                </button>
              </div>
            )}
          </div>
        )}
        {hasReservationData && !hasRooms && !isReservationsError && (
          <div className="mx-3 my-8 min-[900px]:mx-6">
            <div className="mx-auto max-w-2xl">
              <BooEmptyState
                illustration="rest"
                title="선택한 날짜에는 세미나실을 운영하지 않아요"
                description="달력에서 다른 날짜를 확인해 주세요."
              />
            </div>
          </div>
        )}
        {hasRooms && (
          <div className="hidden p-10 md:flex md:justify-end">
            <CustomButton
              disabled={isReserving}
              onClick={openReserveConfirm}
              text="예약하기"
            />
          </div>
        )}
        {hasRooms && (
          <SelectionBar
            roomLabel={
              selectedRoom
                ? `${selectedRoom.roomName}-${selectedRoom.partitionNumber}`
                : null
            }
            dateLabel={selectionDateLabel}
            from={selectedRangeFrom}
            to={selectedRangeTo}
            disabled={isReserving}
            onReserve={openReserveConfirm}
          />
        )}
      </div>

      {/* 선택된 예약 정보 모달 — "타임레일" 디자인. 크림 블록·시간 레일은 시각 표현이라
          시작/종료 라벨과 점선 조각이 아니라 이 블록 전체를 한 문장 aria-label 로 읽는다
          (modalTimeAriaLabel, 위에서 계산). */}
      <Modal
        ref={reserveDialogRef}
        initialFocus={reserveDialogRef}
        className="flex items-center justify-center"
        theme={modalTheme}
        dismissible
        show={openReserveModal}
        onClose={() => setOpenReserveModal(false)}>
        <Modal.Header>이대로 예약할까요?</Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-[13px] rounded-[18px] bg-[#F1EEE9] px-4 pb-[17px] pt-[15px] shadow-[inset_0_0_0_1px_rgba(0,45,86,0.06)]">
            <div className="flex min-w-0 items-center justify-between gap-[10px]">
              <span className="whitespace-nowrap text-[13.5px] font-semibold leading-[1.2] tracking-[-0.012em] text-[#566072]">
                {modalDateLabel}
                {modalEndDateLabel && (
                  <>
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only">부터 </span>
                    <span>{modalEndDateLabel}</span>
                  </>
                )}
              </span>
              <span className="flex-none whitespace-nowrap rounded-full border border-[rgba(0,45,86,0.14)] bg-white px-[11px] py-[6px] text-[14px] font-bold leading-none tracking-[-0.012em] text-[#002D56] shadow-[0_1px_1px_rgba(0,45,86,0.05)]">
                {selectedRoom?.roomName}-{selectedRoom?.partitionNumber}
              </span>
            </div>

            <div
              role="group"
              aria-label={modalTimeAriaLabel}
              className="flex items-end gap-2 pt-px">
              <div
                aria-hidden="true"
                className="flex min-w-0 flex-none flex-col gap-[3px]">
                <span className="h-[14px] text-[11px] font-bold leading-[14px] tracking-[0.09em] text-[#566072]">
                  시작
                </span>
                <span className="h-7 text-[25px] font-extrabold leading-7 tracking-[-0.03em] tabular-nums text-[#002D56] max-[359px]:text-[22px]">
                  {modalFromLabel}
                </span>
              </div>

              <div
                aria-hidden="true"
                className="relative flex h-7 min-w-[62px] flex-1 items-center justify-center self-end">
                <span
                  className="absolute left-0 right-0 top-1/2 -mt-px h-[2px] rounded-[2px]"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(0,45,86,.34) 0 5px, rgba(0,45,86,0) 5px 9px)',
                  }}
                />
                {modalDurationText && (
                  <span className="relative z-[1] mx-[10px] whitespace-nowrap rounded-full border border-[rgba(0,45,86,0.14)] bg-white px-[10px] py-[6px] text-[12px] font-extrabold leading-none tracking-[-0.01em] text-[#002D56] shadow-[0_1px_2px_rgba(0,45,86,0.07)] max-[359px]:mx-[6px] max-[359px]:px-[8px] max-[359px]:py-[5px]">
                    {modalDurationText}
                  </span>
                )}
              </div>

              <div
                aria-hidden="true"
                className="flex min-w-0 flex-none flex-col items-end gap-[3px] text-right">
                <span className="h-[14px] whitespace-nowrap text-[11px] font-bold leading-[14px] tracking-[0.09em] text-[#566072]">
                  {modalEndCaption}
                </span>
                <span className="h-7 text-[25px] font-extrabold leading-7 tracking-[-0.03em] tabular-nums text-[#002D56] max-[359px]:text-[22px]">
                  {modalToLabel}
                </span>
              </div>
            </div>
            {modalCrossesMidnight && (
              <p className="break-keep text-[12.5px] font-medium leading-[1.45] tracking-[-0.01em] text-[#566072]">
                자정을 넘는 예약이에요. 출석은 시작 15분 전부터 한 번만 하면
                돼요.
              </p>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full gap-2.5">
            <Button
              color="light"
              theme={reserveActionButtonTheme}
              className="h-[50px] min-h-[50px] w-[104px] flex-none rounded-[16px] p-0 tracking-[-0.012em] transition duration-150 enabled:active:translate-y-px enabled:active:scale-[0.995] max-[359px]:w-[88px]"
              onClick={() => {
                setOpenReserveModal(false);
              }}>
              취소
            </Button>
            <Button
              disabled={isReserving}
              theme={reserveActionButtonTheme}
              onClick={() => {
                if (isReserving) return;
                handleReservation({
                  roomPartitionId: selectedRoom
                    ? selectedRoom.partitionId
                    : null,
                  startDateTime: selectedRangeFrom,
                  endDateTime: selectedRangeTo,
                });
                setOpenReserveModal(false);
              }}
              color="dark"
              className="h-[50px] min-h-[50px] flex-1 rounded-[16px] p-0 tracking-[-0.012em] transition duration-150 enabled:active:translate-y-px enabled:active:scale-[0.995]">
              예약
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default RoomPage;
