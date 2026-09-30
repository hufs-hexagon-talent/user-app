import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import { fetchDate } from '../../../api/policySchedule.api';
import { useReservations, useReserve } from '../../../api/reservation.api';
import { modalTheme as reserveModalTheme } from '../../../components/modal/modalTheme';

import { shortDateLabel } from './dateLabel';
import { durationLabel } from './durationLabel';
import RoomPage from './RoomPage';

jest.mock('../../../api/reservation.api', () => ({
  useReservations: jest.fn(),
  useReserve: jest.fn(),
}));
// 날짜 목록 조회는 이 시험과 무관하다. 끝나지 않게 두어 렌더 뒤 상태 변경을 막는다.
jest.mock('../../../api/policySchedule.api', () => ({
  fetchDate: jest.fn(() => new Promise(() => {})),
}));
jest.mock('../../../api/user.api', () => ({
  fetchBlockedPeriod: jest.fn(),
  isAuthError: () => false,
}));
jest.mock('../../../hooks/useAuth', () => () => ({ loggedIn: true }));
// 지나간 칸을 피하려고 먼 미래 날짜를 고정한다
jest.mock('../../../hooks/useUrlQuery', () => () => ['2099-01-01', jest.fn()]);
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [jest.fn(), jest.fn()],
}));
// 달력은 그리지 않되 받은 props 는 남겨 둔다 — includeDates 가 빈 배열이면 달력이 통째로 잠긴다.
const mockDatePickerProps = jest.fn();
jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: props => {
    mockDatePickerProps(props);
    return null;
  },
  registerLocale: jest.fn(),
}));
jest.mock('../../admin/banner/Banner', () => () => null);

// 표의 칸은 09:00, 09:30, 10:00, 10:30 네 개가 된다(마지막 라벨은 경계라 렌더하지 않는다).
const room = () => ({
  partitionId: 7,
  roomName: '세미나실',
  partitionNumber: 1,
  operationStartTime: '09:00:00',
  operationEndTime: '11:00:00',
  eachMaxMinute: 120,
  reservationTimeRanges: [],
});

const selectedCells = container =>
  container.querySelectorAll('td.selected').length;

const slotCells = container =>
  Array.from(container.querySelectorAll('tbody [data-time-index]'));

const query = (overrides = {}) => ({
  data: [room()],
  isPending: false,
  isError: false,
  refetch: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useReserve.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
});

describe('예약 현황 재조회 실패', () => {
  // react-query v5 는 재조회가 실패해도 data 를 유지한다. 30초 폴링이나 앱 복귀 재조회가 한 번
  // 실패했다고 표를 오류 카드로 바꾸면, 모바일은 유일한 예약 버튼(SelectionBar)까지 사라져
  // 다음 폴링이 성공할 때까지(최대 30초) 예약을 진행할 수 없다.
  it('받아 둔 표가 있으면 표와 예약하기를 남기고 위에 안내만 얹는다', () => {
    useReservations.mockReturnValue(query({ isError: true }));

    const { container } = render(<RoomPage />);
    // SelectionBar 의 예약하기는 칸을 골라야 나타난다. 데스크톱 버튼과 함께 둘이어야 한다.
    fireEvent.click(slotCells(container)[0]);

    expect(selectedCells(container)).toBe(1);
    expect(screen.getAllByText('예약하기')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(
      '최신 예약 현황을 못 받아왔습니다.',
    );
    expect(screen.queryByText('예약 현황을 불러오지 못했습니다.')).toBeNull();
  });

  it('안내의 다시 시도는 재조회를 부른다', () => {
    const refetch = jest.fn();
    useReservations.mockReturnValue(query({ isError: true, refetch }));

    render(<RoomPage />);
    fireEvent.click(
      within(screen.getByRole('status')).getByRole('button', {
        name: '다시 시도',
      }),
    );

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('받아 둔 표 없이 실패했을 때만 오류 카드를 보여준다', () => {
    useReservations.mockReturnValue(query({ data: undefined, isError: true }));

    render(<RoomPage />);

    expect(
      screen.getByText('예약 현황을 불러오지 못했습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('고른 칸은 재조회가 실패해도 그대로다', () => {
    useReservations.mockReturnValue(query());
    const { container, rerender } = render(<RoomPage />);
    fireEvent.click(slotCells(container)[0]);

    useReservations.mockReturnValue(query({ isError: true }));
    rerender(<RoomPage />);

    expect(selectedCells(container)).toBe(1);
  });
});

describe('예약 가능한 날짜 목록', () => {
  it('빈 캐시를 가진 재조회 실패를 운영 일정 없음으로 안내하지 않는다', () => {
    useReservations.mockReturnValue(query({ data: [], isError: true }));

    render(<RoomPage />);

    expect(
      screen.getByText('예약 현황을 불러오지 못했습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
    expect(screen.queryByText(/세미나실을 운영하지 않아요/)).toBeNull();
  });

  // 방학처럼 운영 일정이 0건이면 서버는 200 + 빈 목록을 준다(예외가 아니라 catch 를 안 탄다).
  // react-datepicker 는 includeDates=[] 를 "허용 날짜 0개" 로 읽어 35칸이 전부 잠기고
  // 월 이동 화살표도 렌더하지 않는다. 빈 응답으로 달력을 통째로 잠그지 않는다.
  it('목록이 비어 있어도 선택한 날짜의 미운영만 안내하고 달력 탐색을 유지한다', async () => {
    fetchDate.mockResolvedValueOnce([]);
    useReservations.mockReturnValue(query({ data: [] }));

    render(<RoomPage />);

    expect(
      await screen.findByText('선택한 날짜에는 세미나실을 운영하지 않아요'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('달력에서 다른 날짜를 확인해 주세요.'),
    ).toBeInTheDocument();
    const props = mockDatePickerProps.mock.calls.at(-1)[0];
    expect(props.includeDates).toBeNull();
    expect(props.showDisabledMonthNavigation).toBe(true);
  });

  it('목록이 있으면 그 날짜들로 달력을 제한한다', async () => {
    const dates = [new Date('2099-01-01T00:00:00')];
    fetchDate.mockResolvedValueOnce(dates);
    useReservations.mockReturnValue(query({ data: [] }));

    render(<RoomPage />);

    await waitFor(() =>
      expect(mockDatePickerProps.mock.calls.at(-1)[0].includeDates).toBe(dates),
    );
    expect(
      screen.getByText('선택한 날짜에는 세미나실을 운영하지 않아요'),
    ).toBeInTheDocument();
  });

  // 잠긴 달력에서 유일하게 통과하는 조작이 "입력칸 비우기" 인데 그 경로가 format(null) 로
  // RangeError 를 던졌다.
  it('날짜 입력을 비워도 예외 없이 넘어간다', () => {
    useReservations.mockReturnValue(query());

    render(<RoomPage />);
    const { onChange } = mockDatePickerProps.mock.calls.at(-1)[0];

    expect(() => onChange(null)).not.toThrow();
  });
});

describe('RoomPage 시간 선택', () => {
  it('30초마다 다시 불러와 방 객체가 새로 와도 고르던 시간을 연장할 수 있다', () => {
    useReservations.mockReturnValue({
      data: [room()],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { container, rerender } = render(<RoomPage />);

    fireEvent.click(slotCells(container)[0]);
    expect(selectedCells(container)).toBe(1);

    // 다른 학생이 예약해 재조회가 돌면 그 방 객체만 새 참조로 바뀐다
    useReservations.mockReturnValue({
      data: [room()],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });
    rerender(<RoomPage />);

    // 이어지는 칸을 누르면 새 선택으로 접히지 않고 연장되어야 한다
    fireEvent.click(slotCells(container)[1]);
    expect(selectedCells(container)).toBe(2);
  });

  it('같은 칸을 다시 누르면 선택이 풀린다', () => {
    useReservations.mockReturnValue({
      data: [room()],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { container } = render(<RoomPage />);

    fireEvent.click(slotCells(container)[0]);
    expect(selectedCells(container)).toBe(1);

    fireEvent.click(slotCells(container)[0]);
    expect(selectedCells(container)).toBe(0);
  });

  // handleSlotClick 의 !state.selectable 가드가 유일한 클라이언트 방어선이다.
  // 칸에 pointer-events:none 이 걸려 있지 않아 클릭 자체는 들어온다.
  it('이미 예약된 칸을 누르면 선택되지 않는다', () => {
    useReservations.mockReturnValue({
      data: [
        {
          ...room(),
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
            },
          ],
        },
      ],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { container } = render(<RoomPage />);

    fireEvent.click(slotCells(container)[0]);

    // td.selected 로는 판별할 수 없다. getSlotState 의 우선순위가 reserved 를 먼저 보므로
    // 가드가 없어 선택이 생겨도 status 는 계속 reserved 다. 선택이 실제로 생겼는지는
    // 모바일 SelectionBar 가 뜨는지로 본다(선택이 없으면 null 을 반환한다).
    expect(screen.queryAllByText('예약하기')).toHaveLength(1);
  });

  it('내 예약 칸을 누르면 선택되지 않는다', () => {
    useReservations.mockReturnValue({
      data: [
        {
          ...room(),
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
              isMine: true,
            },
          ],
        },
      ],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { container } = render(<RoomPage />);

    fireEvent.click(slotCells(container)[0]);

    // 위 시험과 같은 이유로 td.selected 대신 모바일 SelectionBar 로 판별한다.
    expect(screen.queryAllByText('예약하기')).toHaveLength(1);
  });
});

// 표가 실제로 그려졌는지 확인해 두어야 선택 칸 수 비교가 뜻을 갖는다
it('호실 이름을 표에 보여 준다', () => {
  useReservations.mockReturnValue({
    data: [room()],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
  render(<RoomPage />);
  expect(screen.getByText('세미나실-1')).toBeInTheDocument();
});

describe('예약 확인 모달', () => {
  // 09:00 ~ 10:00 두 칸을 골라 예약하기를 눌러 모달을 연다.
  // 데스크톱용·모바일용(SelectionBar) 두 곳에 "예약하기" 버튼이 함께 렌더되므로
  // DOM 순서상 먼저 오는 데스크톱 버튼을 누른다.
  const openModal = container => {
    fireEvent.click(slotCells(container)[0]);
    fireEvent.click(slotCells(container)[1]);
    fireEvent.click(screen.getAllByText('예약하기')[0]);
  };

  beforeEach(() => {
    useReservations.mockReturnValue({
      data: [room()],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  // 모바일에서는 SelectionBar 의 버튼이 유일한 예약 경로다. 데스크톱 버튼만 누르는
  // 테스트로는 이 배선(onReserve={openReserveConfirm})이 끊겨도 잡히지 않는다.
  it('모바일 SelectionBar 의 예약하기로도 모달이 열린다', () => {
    const { container } = render(<RoomPage />);

    fireEvent.click(slotCells(container)[0]);
    fireEvent.click(slotCells(container)[1]);
    fireEvent.click(screen.getAllByText('예약하기')[1]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // Modal.Header 는 children 을 자기 <h3> 안에 넣으므로 여기에 heading 을 또 넣으면
  // <h3><h2>..</h2></h3> 가 된다. 제목은 정확히 하나여야 한다.
  it('제목 heading 이 하나만 있다', () => {
    const { container } = render(<RoomPage />);
    openModal(container);

    const dialog = screen.getByRole('dialog');
    const headings = dialog.querySelectorAll('h1, h2, h3, h4, h5, h6');

    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('이대로 예약할까요?');
  });

  it('호실명·시작 시각·종료 시각·날짜·길이가 모두 화면에 있다', () => {
    const { container } = render(<RoomPage />);
    openModal(container);

    const dialog = screen.getByRole('dialog');
    // useUrlQuery 가 '2099-01-01' 로 고정돼 있다. 시간대에 따라 "(오늘)" 여부가 달라질 수
    // 있어 하드코딩하지 않고 실제 쓰는 함수로 기대값을 계산한다.
    expect(
      within(dialog).getByText(shortDateLabel('2099-01-01')),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('세미나실-1')).toBeInTheDocument();
    expect(within(dialog).getByText('09:00')).toBeInTheDocument();
    expect(within(dialog).getByText('10:00')).toBeInTheDocument();
    expect(within(dialog).getByText(durationLabel(60))).toBeInTheDocument();
  });

  it('시간 블록에 aria-label 이 있고 시작·종료·길이가 들어 있다', () => {
    const { container } = render(<RoomPage />);
    openModal(container);

    const dialog = screen.getByRole('dialog');
    const timeBlock = within(dialog).getByRole('group');

    expect(timeBlock).toHaveAttribute(
      'aria-label',
      expect.stringContaining('09:00'),
    );
    expect(timeBlock.getAttribute('aria-label')).toContain('10:00');
    expect(timeBlock.getAttribute('aria-label')).toContain(durationLabel(60));
  });

  it('취소 버튼에 빨간 배경 클래스가 없다', () => {
    const { container } = render(<RoomPage />);
    openModal(container);

    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: '취소' });
    const classes = cancel.className.split(/\s+/);

    // color가 'failure'(bg-red-700) 등 빨간 계열로 바뀌면 잡아낸다. bg-red-600 하나만
    // 보면 다른 빨강으로 바뀌었을 때 놓치므로 'bg-red-'로 시작하는 클래스 전체를 본다.
    expect(classes.some(c => c.startsWith('bg-red-'))).toBe(false);
  });

  // 위 테스트는 '빨간 배경이 없다'만 본다 — theme={reserveActionButtonTheme} prop을
  // 통째로 빼도(=flowbite 기본 color.light로 되돌아가도) 통과해버린다(리뷰어가 실제로
  // prop을 지우고 확인함). flowbite 기본 테마에는 빨간 배경이 원래 없기 때문이다.
  // 그래서 이 커밋이 새로 넣은 크림/남색 팔레트가 실제로 적용됐는지 긍정 단언으로
  // 따로 확인한다. reserveActionButtonTheme는 RoomPage.jsx가 export하지 않으므로(제품
  // 코드는 고치지 않는다) 소스 텍스트에서 color.light 문자열을 직접 읽어 대조한다 —
  // 값을 테스트에 하드코딩하지 않으므로 테마가 바뀌면 이 테스트도 함께 따라간다.
  it('취소 버튼에 reserveActionButtonTheme.color.light 의 클래스가 실제로 적용된다', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'RoomPage.jsx'),
      'utf8',
    );
    const match = source.match(/\blight:\s*\n?\s*'([^']+)'/);
    expect(match).not.toBeNull();

    const lightClasses = match[1].split(/\s+/).filter(Boolean);
    // flowbite 기본 color.light 와 겹치지 않는다고 확신할 수 있는 클래스만 골라야
    // 의미가 있다 — 임의값(대괄호) 클래스는 이 테마 고유의 색이라 겹칠 일이 없다.
    const distinctiveClasses = lightClasses.filter(c => c.includes('['));
    expect(distinctiveClasses.length).toBeGreaterThan(0);

    const { container } = render(<RoomPage />);
    openModal(container);

    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: '취소' });
    const classes = cancel.className.split(/\s+/);

    distinctiveClasses.forEach(distinctiveClass => {
      expect(classes).toContain(distinctiveClass);
    });
  });

  it('바깥을 누르면 모달이 닫힌다', () => {
    const { container } = render(<RoomPage />);
    openModal(container);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ESC 를 누르면 모달이 닫힌다', () => {
    const { container } = render(<RoomPage />);
    openModal(container);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // jsdom 은 레이아웃이 없어 h-full 때문에 래퍼가 화면을 덮어 바깥 클릭이
  // 오버레이까지 못 내려가는 걸 폭·좌표로는 재현할 수 없다. 대신 그 원인이었던
  // 클래스가 되돌아오지 않는지 테마 상수 자체로 회귀를 막는다. h-full 뿐 아니라
  // h-dvh·min-h-screen 등 같은 버그를 재현하는 전체 높이 유틸 전반을 막는다.
  // svh/lvh(이 레포의 tailwindcss 3.4.17 에서는 코어 유틸)와 min-h-[...] 임의값도
  // 같은 버그를 재현하므로 함께 잡는다.
  it('content.base 에 모바일에서 래퍼가 화면을 덮는 전체 높이 유틸이 없다', () => {
    const forbidden =
      /\b(?:h-full|h-screen|h-dvh|h-svh|h-lvh|min-h-screen|min-h-dvh|min-h-svh|min-h-lvh)\b|\bh-\[100[a-z%]*\]|\bmin-h-\[[^\]]+\]/;
    expect(reserveModalTheme.content.base).not.toMatch(forbidden);
  });

  // 위 정규식은 차단 목록이라 새로운 전체 높이 유틸(svh/lvh 도 처음엔 놓쳤듯)이
  // 나오면 또 놓칠 수 있다. content.base 에 들어갈 클래스 집합을 정확히 고정해
  // 이중으로 막는다 — 여기에 무엇이든 더하려면(특히 h-full/h-svh/min-h-[100dvh] 같은
  // 전체 높이 유틸) 이 테스트를 함께 고쳐야 한다. 그 래퍼가 뷰포트를 다시 덮으면
  // 모바일에서 바깥 클릭 닫힘이 죽는다 — floating-ui 의 useDismiss 가 이 래퍼를
  // floating element 로 보고 outside-press 를 판정하기 때문이다.
  it('content.base 는 기대한 클래스만 갖는다', () => {
    expect(
      reserveModalTheme.content.base.split(/\s+/).filter(Boolean).sort(),
    ).toEqual(['relative', 'w-full', 'p-4', 'focus:outline-none'].sort());
  });

  // 대화상자 컨테이너가 initialFocus 대상이 되려면 그 role="dialog" div 의 className 이
  // content.base 를 그대로 쓰므로, 포커스를 받아도 링이 안 보이려면 여기에
  // focus:outline-none 이 있어야 한다.
  it('content.base 에 focus:outline-none 이 있다', () => {
    expect(reserveModalTheme.content.base).toMatch(/\bfocus:outline-none\b/);
  });
});

// 24시간 운영 작업(칸 모델을 분 단위로 바꾸는 리팩터링) 전에 지금 동작을 고정해 둔다.
// 픽스처는 모두 옛 서버 응답 모양이라 endsAtMidnight 가 없다. 새 화면이 옛 API 를 만나도
// 이 표들은 그대로여야 한다.
describe('평상 날과 옛 서버 응답(새 필드 없음)의 예약표', () => {
  const partition = (over = {}) => ({
    partitionId: 11,
    roomName: '306',
    partitionNumber: 1,
    operationStartTime: '09:00:00',
    operationEndTime: '22:00:00',
    eachMaxMinute: 120,
    reservationTimeRanges: [],
    ...over,
  });
  const other = (over = {}) =>
    partition({ partitionId: 21, roomName: '428', ...over });

  const renderWith = rooms => {
    useReservations.mockReturnValue(query({ data: rooms }));
    return render(<RoomPage />);
  };

  const headCells = container =>
    Array.from(container.querySelectorAll('thead [data-time-index]'));

  const rowCells = (container, label) => {
    const row = Array.from(container.querySelectorAll('tbody tr')).find(
      tr => tr.querySelector('th')?.textContent === label,
    );
    return Array.from(row.querySelectorAll('[data-time-index]'));
  };

  const cellLabel = (container, label, hm) =>
    rowCells(container, label)
      .map(cell => cell.getAttribute('aria-label'))
      .find(name => name.startsWith(`${label} ${hm} `));

  it('09:00~22:00 인 날은 스물여섯 칸이고 머리글은 정시마다 적는다', () => {
    const { container } = renderWith([partition(), other()]);

    const heads = headCells(container);
    expect(heads).toHaveLength(26);
    expect(heads[0]).toHaveAttribute('aria-label', '09:00~09:30');
    expect(heads[25]).toHaveAttribute('aria-label', '21:30~22:00');
    expect(heads.map(cell => cell.textContent).filter(Boolean)).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
      '19:00',
      '20:00',
      '21:00',
    ]);

    const cells = rowCells(container, '306-1');
    expect(cells).toHaveLength(26);
    expect(cells[0]).toHaveAttribute('aria-label', '306-1 09:00 예약 가능');
    expect(cells[25]).toHaveAttribute('aria-label', '306-1 21:30 예약 가능');
    expect(rowCells(container, '428-1')).toHaveLength(26);
  });

  it('호실마다 종료가 다르면 늦은 쪽까지 그리고 일찍 닫는 호실의 남은 칸은 잠근다', () => {
    const { container } = renderWith([
      partition(),
      other({ operationEndTime: '18:00:00' }),
    ]);

    expect(headCells(container)).toHaveLength(26);
    expect(cellLabel(container, '428-1', '17:30')).toBe(
      '428-1 17:30 예약 가능',
    );
    expect(cellLabel(container, '428-1', '18:00')).toBe(
      '428-1 18:00 예약 불가',
    );
    expect(cellLabel(container, '306-1', '21:30')).toBe(
      '306-1 21:30 예약 가능',
    );
  });

  it('00:00~23:30 호실과 평상 호실이 섞인 날은 00:00 부터 23:30 까지 그리고 호실별로 잠근다', () => {
    const { container } = renderWith([
      partition({
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
      }),
      other(),
    ]);

    const heads = headCells(container);
    expect(heads).toHaveLength(47);
    expect(heads[0]).toHaveAttribute('aria-label', '00:00~00:30');
    expect(heads[46]).toHaveAttribute('aria-label', '23:00~23:30');
    expect(cellLabel(container, '306-1', '00:00')).toBe(
      '306-1 00:00 예약 가능',
    );
    expect(cellLabel(container, '306-1', '23:00')).toBe(
      '306-1 23:00 예약 가능',
    );
    expect(cellLabel(container, '428-1', '08:30')).toBe(
      '428-1 08:30 예약 불가',
    );
    expect(cellLabel(container, '428-1', '09:00')).toBe(
      '428-1 09:00 예약 가능',
    );
    expect(cellLabel(container, '428-1', '22:00')).toBe(
      '428-1 22:00 예약 불가',
    );
  });

  it('종료가 23:59:59 인 옛 정책은 23:00~23:30 이 마지막 칸이다', () => {
    const { container } = renderWith([
      partition({ operationEndTime: '23:59:59' }),
    ]);

    const heads = headCells(container);
    expect(heads).toHaveLength(29);
    expect(heads[28]).toHaveAttribute('aria-label', '23:00~23:30');
    expect(cellLabel(container, '306-1', '23:00')).toBe(
      '306-1 23:00 예약 가능',
    );
  });

  it('평상 날 마지막 두 칸을 고르면 하단 바·확인 모달·전송 시각이 그날 21:00~22:00 이다', () => {
    const doReserve = jest.fn().mockResolvedValue({});
    useReserve.mockReturnValue({ mutateAsync: doReserve, isPending: false });
    const { container } = renderWith([partition(), other()]);

    const cells = rowCells(container, '306-1');
    fireEvent.click(cells[24]);
    fireEvent.click(cells[25]);

    expect(screen.getByText('306-1 · 21:00~22:00')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('예약하기')[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('21:00')).toBeInTheDocument();
    expect(within(dialog).getByText('22:00')).toBeInTheDocument();
    expect(within(dialog).getByText(durationLabel(60))).toBeInTheDocument();
    expect(within(dialog).getByRole('group')).toHaveAttribute(
      'aria-label',
      `${shortDateLabel('2099-01-01')} 21:00부터 22:00까지, ${durationLabel(60)}`,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: '예약' }));

    expect(doReserve).toHaveBeenCalledTimes(1);
    const body = doReserve.mock.calls[0][0];
    expect(body.roomPartitionId).toBe(11);
    // 서버는 절대 시각을 받는다. KST 21:00 은 UTC 12:00 이다.
    expect(body.startDateTime.toISOString()).toBe('2099-01-01T12:00:00.000Z');
    expect(body.endDateTime.toISOString()).toBe('2099-01-01T13:00:00.000Z');
  });
});

// 새 서버는 자정까지 여는 정책을 endsAtMidnight=true 와 저장 종료 23:30:00 으로 준다.
describe('자정(24:00)까지 여는 날의 예약표', () => {
  const midnight = (over = {}) => ({
    partitionId: 11,
    roomName: '306',
    partitionNumber: 1,
    operationStartTime: '00:00:00',
    operationEndTime: '23:30:00',
    endsAtMidnight: true,
    eachMaxMinute: 120,
    reservationTimeRanges: [],
    ...over,
  });
  const plain = (over = {}) => ({
    partitionId: 21,
    roomName: '428',
    partitionNumber: 1,
    operationStartTime: '09:00:00',
    operationEndTime: '22:00:00',
    endsAtMidnight: false,
    eachMaxMinute: 120,
    reservationTimeRanges: [],
    ...over,
  });

  const renderWith = rooms => {
    useReservations.mockReturnValue(query({ data: rooms }));
    return render(<RoomPage />);
  };
  const headCells = container =>
    Array.from(container.querySelectorAll('thead [data-time-index]'));
  const rowCells = (container, label) => {
    const row = Array.from(container.querySelectorAll('tbody tr')).find(
      tr => tr.querySelector('th')?.textContent === label,
    );
    return Array.from(row.querySelectorAll('[data-time-index]'));
  };

  it('00:00~24:00 마흔여덟 칸이고 마지막 칸은 23:30~24:00 이다', () => {
    const { container } = renderWith([midnight()]);

    const heads = headCells(container);
    expect(heads).toHaveLength(48);
    expect(heads[47]).toHaveAttribute('aria-label', '23:30~24:00');
    expect(rowCells(container, '306-1')[47]).toHaveAttribute(
      'aria-label',
      '306-1 23:30 예약 가능',
    );
  });

  it('새 서버가 false 를 준 00:00~23:30 은 지금처럼 마흔일곱 칸이다', () => {
    const { container } = renderWith([midnight({ endsAtMidnight: false })]);

    const heads = headCells(container);
    expect(heads).toHaveLength(47);
    expect(heads[46]).toHaveAttribute('aria-label', '23:00~23:30');
  });

  it('평상 호실과 섞이면 표는 24:00 까지 그리고 평상 호실의 밤 칸은 잠근다', () => {
    const { container } = renderWith([midnight(), plain()]);

    expect(headCells(container)).toHaveLength(48);
    const plainCells = rowCells(container, '428-1');
    expect(plainCells[47]).toHaveAttribute(
      'aria-label',
      '428-1 23:30 예약 불가',
    );
    expect(plainCells[44]).toHaveAttribute(
      'aria-label',
      '428-1 22:00 예약 불가',
    );
    expect(plainCells[17]).toHaveAttribute(
      'aria-label',
      '428-1 08:30 예약 불가',
    );
    expect(plainCells[18]).toHaveAttribute(
      'aria-label',
      '428-1 09:00 예약 가능',
    );

    // 잠긴 칸은 눌러도 선택되지 않는다(하단 바의 예약하기가 생기지 않는다)
    fireEvent.click(plainCells[47]);
    expect(screen.queryAllByText('예약하기')).toHaveLength(1);
  });

  it('23:30 칸을 고르면 하단 바·확인 모달은 24:00 으로 적고 끝은 다음 날 00:00 으로 보낸다', () => {
    const doReserve = jest.fn().mockResolvedValue({});
    useReserve.mockReturnValue({ mutateAsync: doReserve, isPending: false });
    const { container } = renderWith([midnight(), plain()]);

    fireEvent.click(rowCells(container, '306-1')[47]);

    expect(screen.getByText('306-1 · 23:30~24:00')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('예약하기')[0]);
    const dialog = screen.getByRole('dialog');
    // 날짜는 선택한 예약이 시작하는 날이다. 이 표에서는 선택이 늘 selectedDate 에서 시작하므로
    // 두 값을 구분하지 못한다. 자정을 넘는 선택의 날짜는 이어 붙이는 칸을 다루는 테스트가 고정한다.
    expect(
      within(dialog).getByText(shortDateLabel('2099-01-01')),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('23:30')).toBeInTheDocument();
    expect(within(dialog).getByText('24:00')).toBeInTheDocument();
    expect(within(dialog).queryByText('00:00')).toBeNull();
    expect(within(dialog).getByRole('group')).toHaveAttribute(
      'aria-label',
      `${shortDateLabel('2099-01-01')} 23:30부터 24:00까지, ${durationLabel(30)}`,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: '예약' }));

    expect(doReserve).toHaveBeenCalledTimes(1);
    const body = doReserve.mock.calls[0][0];
    expect(body.roomPartitionId).toBe(11);
    expect(body.startDateTime.toISOString()).toBe('2099-01-01T14:30:00.000Z');
    // D+1 00:00 KST = D 15:00Z
    expect(body.endDateTime.toISOString()).toBe('2099-01-01T15:00:00.000Z');
  });

  it('23:00 과 23:30 을 이어 고르면 23:00~24:00 한 건이다', () => {
    const doReserve = jest.fn().mockResolvedValue({});
    useReserve.mockReturnValue({ mutateAsync: doReserve, isPending: false });
    const { container } = renderWith([midnight()]);

    const cells = rowCells(container, '306-1');
    fireEvent.click(cells[46]);
    fireEvent.click(cells[47]);

    expect(screen.getByText('306-1 · 23:00~24:00')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('예약하기')[0]);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '예약' }),
    );

    const body = doReserve.mock.calls[0][0];
    expect(body.startDateTime.toISOString()).toBe('2099-01-01T14:00:00.000Z');
    expect(body.endDateTime.toISOString()).toBe('2099-01-01T15:00:00.000Z');
  });
});
