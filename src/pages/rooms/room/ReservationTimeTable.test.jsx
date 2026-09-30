import React from 'react';
import { fireEvent, render } from '@testing-library/react';

import { buildSlots } from './operationWindow';
import ReservationTimeTable from './ReservationTimeTable';

const room = (over = {}) => ({
  partitionId: 1,
  roomName: '세미나실',
  partitionNumber: 1,
  operationStartTime: '09:00:00',
  operationEndTime: '11:00:00',
  eachMaxMinute: 120,
  reservationTimeRanges: [],
  ...over,
});

// 09:00~11:00 이라 칸은 09:00, 09:30, 10:00, 10:30 네 개다
const slots = buildSlots([room()], '2099-01-01');

const setup = (over = {}) =>
  render(
    <ReservationTimeTable
      rooms={[room()]}
      slots={slots}
      selectedDate="2099-01-01"
      now={new Date('2099-01-01T00:00:00')}
      selection={null}
      onCellClick={jest.fn()}
      {...over}
    />,
  );

describe('ReservationTimeTable 열 구성', () => {
  it('헤더의 시각 열 수가 본문의 칸 수와 같다', () => {
    const { container } = setup();
    const headSlots = container.querySelectorAll('thead [data-time-index]');
    const bodySlots = container.querySelectorAll('tbody [data-time-index]');
    expect(headSlots.length).toBe(slots.length);
    expect(bodySlots.length).toBe(slots.length);
  });

  // 원래 버그는 라벨이 sticky 호실명 열 아래로 겹쳐 보이던 CSS 문제였다. jsdom 은
  // 레이아웃을 계산하지 않아 그 겹침을 재현하지 못하므로, 아래 검증은 텍스트가
  // 잘리지 않고 온전히 들어가는지만 보장한다. 버그가 있던 화면에서도 textContent
  // 자체는 '09:00' 그대로였을 것이므로 시각적 겹침의 회귀는 이 테스트로 잡히지 않는다.
  it('첫 시각 라벨의 텍스트가 온전히 들어간다', () => {
    const { container } = setup();
    const first = container.querySelector('thead [data-time-index="0"]');
    expect(first.textContent).toBe('09:00');
  });
});

describe('ReservationTimeTable 접근성', () => {
  it('칸마다 호실과 시각과 상태를 읽을 수 있는 이름이 붙는다', () => {
    const { container } = setup();
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('aria-label', '세미나실-1 09:00 예약 가능');
  });

  it('고를 수 없는 칸은 aria-disabled 다', () => {
    const { container } = setup({
      rooms: [
        room({
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
            },
          ],
        }),
      ],
    });
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('aria-disabled', 'true');
  });

  it('엔터로도 칸을 고를 수 있다', () => {
    const onCellClick = jest.fn();
    const { container } = setup({ onCellClick });
    const first = container.querySelector('tbody [data-time-index="0"]');
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it('스페이스로도 칸을 고를 수 있다', () => {
    const onCellClick = jest.fn();
    const { container } = setup({ onCellClick });
    const first = container.querySelector('tbody [data-time-index="0"]');
    fireEvent.keyDown(first, { key: ' ' });
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it('고를 수 없는 칸은 탭 순서에서 빠진다', () => {
    const { container } = setup({
      rooms: [
        room({
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
            },
          ],
        }),
      ],
    });
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('tabIndex', '-1');
  });

  it('내 예약 칸은 이름으로도 내 것임을 알 수 있고 고를 수 없다', () => {
    const { container } = setup({
      rooms: [
        room({
          reservationTimeRanges: [
            {
              startDateTime: '2099-01-01T09:00:00',
              endDateTime: '2099-01-01T09:30:00',
              isMine: true,
            },
          ],
        }),
      ],
    });
    const first = container.querySelector('tbody [data-time-index="0"]');
    expect(first).toHaveAttribute('aria-label', '세미나실-1 09:00 내 예약');
    expect(first).toHaveAttribute('aria-disabled', 'true');
    expect(first).toHaveAttribute('tabIndex', '-1');
  });

  it('표에 무엇을 담은 표인지 설명이 있다', () => {
    const { container } = setup();
    expect(container.querySelector('caption').textContent).toBe(
      '호실별 30분 단위 예약 현황',
    );
  });
});

describe('ReservationTimeTable 자정 정책', () => {
  it('자정까지 여는 날은 48열이고 마지막 머리글은 23:30~24:00 이다', () => {
    const midnight = room({
      operationStartTime: '00:00:00',
      operationEndTime: '23:30:00',
      endsAtMidnight: true,
    });
    const { container } = setup({
      rooms: [midnight],
      slots: buildSlots([midnight], '2099-01-01'),
    });

    const heads = container.querySelectorAll('thead [data-time-index]');
    expect(heads).toHaveLength(48);
    expect(heads[47]).toHaveAttribute('aria-label', '23:30~24:00');
    const cells = container.querySelectorAll('tbody [data-time-index]');
    expect(cells[47]).toHaveAttribute(
      'aria-label',
      '세미나실-1 23:30 예약 가능',
    );
  });
});

// 공개 예약표 응답의 overnightUntil(A2)로 23:30 칸 뒤에 다음 날 새벽 칸을 붙인 표
describe('ReservationTimeTable 익일 꼬리', () => {
  const midnight = (over = {}) =>
    room({
      operationStartTime: '00:00:00',
      operationEndTime: '23:30:00',
      endsAtMidnight: true,
      ...over,
    });
  // 2099-01-02 01:30 KST
  const tail = midnight({ overnightUntil: '2099-01-01T16:30:00Z' });
  const other = midnight({
    partitionId: 2,
    partitionNumber: 2,
    overnightUntil: null,
  });
  const renderTail = (rooms = [tail, other]) =>
    setup({ rooms, slots: buildSlots(rooms, '2099-01-01') });
  const heads = container =>
    container.querySelectorAll('thead [data-time-index]');
  const rowCells = (container, rowIndex) =>
    container
      .querySelectorAll('tbody tr')
      [rowIndex].querySelectorAll('[data-time-index]');

  it('꼬리 머리글의 접근 이름에 날짜를 넣고 첫 칸에 날짜 칩을 얹는다', () => {
    const { container } = renderTail();

    const cells = heads(container);
    expect(cells).toHaveLength(51);
    expect(cells[47]).toHaveAttribute('aria-label', '23:30~24:00');
    expect(cells[48]).toHaveAttribute('aria-label', '1월 2일 00:00~00:30');
    expect(cells[50]).toHaveAttribute('aria-label', '1월 2일 01:00~01:30');
    expect(cells[48].textContent).toBe('1.2(금)00:00');
    expect(cells[50].textContent).toBe('01:00');
    // 칩은 이 칸 하나에만 있다
    expect(
      Array.from(cells).filter(cell => cell.textContent.includes('(')),
    ).toHaveLength(1);
  });

  it('꼬리 칸의 접근 이름에 날짜를 넣고, 꼬리가 없는 호실은 잠근다', () => {
    const { container } = renderTail();

    expect(rowCells(container, 0)[49]).toHaveAttribute(
      'aria-label',
      '세미나실-1 1월 2일 00:30 예약 가능',
    );
    expect(rowCells(container, 0)[47]).toHaveAttribute(
      'aria-label',
      '세미나실-1 23:30 예약 가능',
    );
    const locked = rowCells(container, 1)[48];
    expect(locked).toHaveAttribute(
      'aria-label',
      '세미나실-2 1월 2일 00:00 예약 불가',
    );
    expect(locked).toHaveAttribute('aria-disabled', 'true');
  });

  it('23:30 칸과 다음 날 00:00 칸 사이에 자정선을 긋는다', () => {
    const { container } = renderTail();

    [0, 1].forEach(row => {
      expect(rowCells(container, row)[47]).toHaveStyle({
        borderRight: '2px solid #002D56',
      });
      expect(rowCells(container, row)[48]).toHaveStyle({
        borderRight: '1px solid #D6D3CF',
      });
    });
  });

  it('꼬리가 없는 자정 날에는 자정선 없이 표를 닫는다', () => {
    const { container } = renderTail([other]);

    expect(heads(container)).toHaveLength(48);
    expect(rowCells(container, 0)[47]).toHaveStyle({
      borderRight: '1px solid #B6B4B0',
    });
  });

  it('꼬리 칸을 누르면 표는 선택을 판정하지 않고 칸 번호와 상태를 넘긴다', () => {
    const onCellClick = jest.fn();
    const rooms = [tail];
    const { container } = setup({
      rooms,
      slots: buildSlots(rooms, '2099-01-01'),
      onCellClick,
    });

    fireEvent.click(rowCells(container, 0)[48]);

    expect(onCellClick).toHaveBeenCalledTimes(1);
    const [, timeIndex, state] = onCellClick.mock.calls[0];
    expect(timeIndex).toBe(48);
    expect(state).toMatchObject({ status: 'free', selectable: true });
  });
});

// jsdom 은 레이아웃이 없어 offsetLeft 가 늘 0 이다. 머리글 칸의 위치를 칸 번호로 흉내 내고
// 스크롤 컨테이너에 들어간 scrollLeft 를 읽어 첫 위치가 어느 칸인지 본다.
describe('ReservationTimeTable 첫 스크롤 위치', () => {
  const STICKY = 52;
  const CELL = 44;
  let offsetLeft;
  let offsetWidth;
  let scrollLeft;

  beforeEach(() => {
    offsetLeft = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetLeft',
    );
    offsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    );
    scrollLeft = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollLeft',
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get() {
        const index = this.getAttribute('data-time-index');
        return index === null ? 0 : STICKY + Number(index) * CELL;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return this.hasAttribute('data-sticky-col') ? STICKY : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get() {
        return this.recordedScrollLeft ?? 0;
      },
      set(value) {
        this.recordedScrollLeft = value;
      },
    });
  });

  afterEach(() => {
    const restore = (name, descriptor) => {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, name, descriptor);
      } else {
        delete HTMLElement.prototype[name];
      }
    };
    restore('offsetLeft', offsetLeft);
    restore('offsetWidth', offsetWidth);
    restore('scrollLeft', scrollLeft);
  });

  const scrolledIndex = container =>
    container.querySelector('.MuiTableContainer-root').scrollLeft / CELL;

  // 두 날 모두 미래라 '오늘' 규칙을 타지 않는다
  const now = new Date('2098-12-31T12:00:00');
  const plain = room({ operationEndTime: '22:00:00' });
  const allDay = room({
    operationStartTime: '00:00:00',
    operationEndTime: '23:30:00',
    endsAtMidnight: true,
  });

  it('00:00 부터 여는 미래 날짜는 09:00 칸에서 시작한다', () => {
    const { container } = setup({
      rooms: [allDay],
      slots: buildSlots([allDay], '2099-01-02'),
      selectedDate: '2099-01-02',
      now,
    });

    expect(scrolledIndex(container)).toBe(18);
  });

  // 옛 RoomPage 는 표 범위를 effect 로 state 에 옮겨 한 렌더 늦었다. 날짜가 바뀐 첫 렌더는 이전 날의
  // 칸 목록으로 그려지고, 첫 위치 키가 날짜뿐이라 다음 렌더에 칸 목록이 바뀌어도 위치를 다시 잡지 않았다.
  it('날짜가 먼저 바뀌고 칸 목록이 뒤따라 바뀌어도 새 칸 목록으로 첫 위치를 다시 잡는다', () => {
    const plainSlots = buildSlots([plain], '2099-01-01');
    const { container, rerender } = setup({
      rooms: [plain],
      slots: plainSlots,
      selectedDate: '2099-01-01',
      now,
    });
    expect(scrolledIndex(container)).toBe(0);

    const props = {
      now,
      selection: null,
      onCellClick: jest.fn(),
    };
    rerender(
      <ReservationTimeTable
        {...props}
        rooms={[plain]}
        slots={plainSlots}
        selectedDate="2099-01-02"
      />,
    );
    rerender(
      <ReservationTimeTable
        {...props}
        rooms={[allDay]}
        slots={buildSlots([allDay], '2099-01-02')}
        selectedDate="2099-01-02"
      />,
    );

    expect(scrolledIndex(container)).toBe(18);
  });

  it('30초 재조회로 칸 목록이 새로 와도 같은 날·같은 칸이면 위치를 되돌리지 않는다', () => {
    const { container, rerender } = setup({
      rooms: [allDay],
      slots: buildSlots([allDay], '2099-01-02'),
      selectedDate: '2099-01-02',
      now,
    });
    const el = container.querySelector('.MuiTableContainer-root');
    // 학생이 가로로 밀어 둔 위치
    el.scrollLeft = 30 * CELL;

    rerender(
      <ReservationTimeTable
        rooms={[{ ...allDay }]}
        slots={buildSlots([allDay], '2099-01-02')}
        selectedDate="2099-01-02"
        now={new Date('2098-12-31T12:00:30')}
        selection={null}
        onCellClick={jest.fn()}
      />,
    );

    expect(scrolledIndex(container)).toBe(30);
  });
});
