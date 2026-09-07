import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { modalTheme } from '../../components/modal/modalTheme';

import ReservationPickerModal, {
  INITIAL_LIMIT,
  MORE_STEP,
  PICKER_EMPTY_ATTENDANCE_HINT,
  PICKER_EMPTY_MESSAGE,
  PICKER_ERROR_MESSAGE,
  PICKER_LOADING_MESSAGE,
  PICKER_NO_DISPUTABLE_MESSAGE,
  PICKER_STALE_MESSAGE,
} from './ReservationPickerModal';

// 종료가 과거인 NOT_VISITED = 미출석(이의 대상), 미래 = 예약 예정(대상 아님).
const NOSHOW = {
  reservationId: 10,
  roomName: '306',
  partitionNumber: '1',
  reservationStartTime: '2026-08-05T10:00:00',
  reservationEndTime: '2026-08-05T11:00:00',
  reservationState: 'NOT_VISITED',
};
const PROCESSED = {
  reservationId: 20,
  roomName: '428',
  partitionNumber: '2',
  reservationStartTime: '2026-08-04T14:00:00',
  reservationEndTime: '2026-08-04T15:00:00',
  reservationState: 'PROCESSED',
};
const VISITED = {
  reservationId: 30,
  roomName: '306',
  partitionNumber: '2',
  reservationStartTime: '2026-08-05T13:00:00',
  reservationEndTime: '2026-08-05T14:00:00',
  reservationState: 'VISITED',
};
const UPCOMING = {
  reservationId: 40,
  roomName: '306',
  partitionNumber: '3',
  reservationStartTime: '2099-01-01T10:00:00',
  reservationEndTime: '2099-01-01T11:00:00',
  reservationState: 'NOT_VISITED',
};
const ALL = [NOSHOW, PROCESSED, VISITED, UPCOMING];
const NAME_NOSHOW = '2026-08-05 10:00~11:00 306-1 미출석';
const NAME_PROCESSED = '2026-08-04 14:00~15:00 428-2 처리됨';
const NAME_VISITED = '2026-08-05 13:00~14:00 306-2 출석';
const NAME_UPCOMING = '2099-01-01 10:00~11:00 306-3 예약 예정';

const renderPicker = (over = {}) => {
  const props = {
    show: true,
    onClose: jest.fn(),
    onPick: jest.fn(),
    selectedId: null,
    reservations: ALL,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    category: 'ATTENDANCE',
    ...over,
  };
  const utils = render(<ReservationPickerModal {...props} />);
  return { ...utils, props };
};
// 필터 칩도 aria-pressed 를 갖는다. 카드만 세려면 접근 이름(날짜·호실·상태)까지 있는 버튼을 고른다.
const cardButtons = () =>
  screen
    .getAllByRole('button')
    .filter(
      button =>
        button.hasAttribute('aria-pressed') &&
        button.hasAttribute('aria-label'),
    );
const selectedCards = () =>
  cardButtons().filter(
    button => button.getAttribute('aria-pressed') === 'true',
  );
const chip = name =>
  screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('ReservationPickerModal 기본', () => {
  it('열리면 dialog 에 공용 테마가 적용되고 제목이 하나다', () => {
    renderPicker();
    const dialog = screen.getByRole('dialog');

    expect(dialog.className.split(/\s+/).filter(Boolean).sort()).toEqual(
      [
        ...modalTheme.content.base.split(/\s+/),
        ...modalTheme.root.sizes['2xl'].split(/\s+/),
      ]
        .filter(Boolean)
        .sort(),
    );
    expect(
      within(dialog).getByRole('heading', { name: '예약 선택' }),
    ).toBeInTheDocument();
    expect(dialog.querySelector('.pb-5')).not.toBeNull();
  });

  it('열릴 때 refetch 를 한 번 부르고, 닫혀 있으면 부르지 않는다', () => {
    const { props, rerender } = renderPicker({ show: false });
    expect(props.refetch).not.toHaveBeenCalled();

    rerender(<ReservationPickerModal {...props} show />);
    expect(props.refetch).toHaveBeenCalledTimes(1);
  });

  it('카드를 누르면 onPick 뒤 onClose 가 불린다', () => {
    const { props } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: NAME_NOSHOW }));

    expect(props.onPick).toHaveBeenCalledWith(NOSHOW);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('selectedId 와 같은 카드만 aria-pressed 와 선택됨 표시를 갖는다', () => {
    renderPicker({ selectedId: PROCESSED.reservationId });
    const [pressed, ...rest] = selectedCards();

    expect(rest).toHaveLength(0);
    expect(pressed).toHaveAccessibleName(NAME_PROCESSED);
    expect(screen.getByText('선택됨').closest('li')).toBe(
      pressed.closest('li'),
    );
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    renderPicker({ show: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ReservationPickerModal 필터', () => {
  // 노쇼는 4회면 차단이라 이 집합은 사실상 한 자릿수 — 학생이 찾는 예약이 첫 화면에 온다.
  it('출석 유형은 미출석·처리됨만 기본으로 보이고 칩에 건수가 붙는다', () => {
    renderPicker();

    expect(chip('미출석·처리됨')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('미출석·처리됨')).toHaveTextContent('2');
    expect(chip('전체')).toHaveTextContent('4');
    expect(cardButtons().map(b => b.getAttribute('aria-label'))).toEqual([
      NAME_NOSHOW,
      NAME_PROCESSED,
    ]);

    fireEvent.click(chip('전체'));
    expect(cardButtons()).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: NAME_VISITED }),
    ).toBeInTheDocument();
  });

  // 기타 문의는 지금·앞으로의 예약을 연결한다. 과거 미출석만 보이면 정작 연결하려던 예약이 없다.
  it('기타 유형과 유형 없음은 전체가 기본이다', () => {
    const { unmount } = renderPicker({ category: 'ETC' });
    expect(chip('전체')).toHaveAttribute('aria-pressed', 'true');
    expect(cardButtons()).toHaveLength(4);
    unmount();

    renderPicker({ category: undefined });
    expect(chip('전체')).toHaveAttribute('aria-pressed', 'true');
  });

  it('미출석·처리됨이 0건이면 전체로 열리고 안내 한 줄을 보인다', () => {
    renderPicker({ reservations: [VISITED, UPCOMING] });

    expect(chip('전체')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(PICKER_NO_DISPUTABLE_MESSAGE)).toBeInTheDocument();
  });

  // 기타 문의에서 이 칩을 직접 누르면 목록이 비는데, 안내가 없으면 고장으로 읽힌다.
  it('기타 문의에서 미출석·처리됨 칩을 눌러 0건이 되면 안내를 보인다', () => {
    renderPicker({ reservations: [VISITED, UPCOMING], category: 'ETC' });
    expect(screen.queryByText(PICKER_NO_DISPUTABLE_MESSAGE)).toBeNull();

    fireEvent.click(chip('미출석·처리됨'));

    expect(cardButtons()).toHaveLength(0);
    expect(screen.getByText(PICKER_NO_DISPUTABLE_MESSAGE)).toBeInTheDocument();
  });

  // 수정 모드에서 출석 예약이 연결된 문의를 열면 선택된 카드가 기본 필터에 없어 "풀렸다" 고 오독한다.
  it('선택된 예약이 미출석·처리됨이 아니면 전체로 연다', () => {
    renderPicker({ selectedId: VISITED.reservationId });

    expect(chip('전체')).toHaveAttribute('aria-pressed', 'true');
    expect(selectedCards()[0]).toHaveAccessibleName(NAME_VISITED);
  });

  // 응답이 뒤늦게 오면 목록이 손 밑에서 갈아치워진다 — 초기 필터는 여는 순간 한 번만 정한다.
  it('열린 뒤 목록이 바뀌어도 필터는 그대로고, 다시 열면 초기값으로 돌아간다', () => {
    const { props, rerender } = renderPicker({ reservations: [VISITED] });
    expect(chip('전체')).toHaveAttribute('aria-pressed', 'true');

    rerender(<ReservationPickerModal {...props} reservations={ALL} />);
    expect(chip('전체')).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <ReservationPickerModal {...props} reservations={ALL} show={false} />,
    );
    rerender(<ReservationPickerModal {...props} reservations={ALL} show />);
    expect(chip('미출석·처리됨')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ReservationPickerModal 날짜 그룹·더 보기', () => {
  it('날짜별 제목 아래 카드가 묶이고, 카드에는 시각만·접근 이름에는 날짜까지 있다', () => {
    renderPicker({ category: 'ETC' });

    expect(
      screen.getByRole('heading', { name: '2026-08-05 (수)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '2026-08-04 (화)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '2099-01-01 (목)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: NAME_UPCOMING }),
    ).toHaveTextContent('10:00~11:00');
    expect(
      screen.getByRole('button', { name: NAME_UPCOMING }),
    ).not.toHaveTextContent('2099-01-01');
  });

  it('전체는 처음 다섯 건만 보이고 더 보기로 열 건씩 늘어난다', () => {
    const many = Array.from({ length: 17 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(i + 1).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(i + 1).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ETC' });

    expect(cardButtons()).toHaveLength(INITIAL_LIMIT);
    fireEvent.click(
      screen.getByRole('button', { name: `더 보기 (${MORE_STEP}건)` }),
    );
    expect(cardButtons()).toHaveLength(INITIAL_LIMIT + MORE_STEP);
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (2건)' }));
    expect(cardButtons()).toHaveLength(17);
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
  });

  // 선택 항목 펼침과 "더 보기" 가 카운터를 공유하면 첫 클릭이 아무것도 늘리지 못한다.
  it('선택 항목까지 펼쳐진 상태에서도 더 보기 한 번에 열 건이 늘어난다', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      // 최신순으로 100, 101, ... 이 되도록 날짜를 내림차순으로 준다.
      reservationStartTime: `2026-07-${String(30 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(30 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ETC', selectedId: 120 });

    // 선택 카드(21번째)까지 펼쳐서 열린다.
    expect(cardButtons()).toHaveLength(21);
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (9건)' }));
    expect(cardButtons()).toHaveLength(30);
  });

  // 마지막 클릭에서 버튼이 자기 자신을 지운다 — 포커스가 body 로 떨어지면 목록에서 위치를 잃는다.
  it('더 보기를 누르면 새로 드러난 첫 카드로 포커스가 간다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(8 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(8 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ETC' });

    fireEvent.click(screen.getByRole('button', { name: '더 보기 (3건)' }));

    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
    expect(cardButtons()[INITIAL_LIMIT]).toHaveFocus();
  });

  it('더 보기는 전체 필터에서만 나온다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...NOSHOW,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(8 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(8 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many });

    expect(chip('미출석·처리됨')).toHaveAttribute('aria-pressed', 'true');
    expect(cardButtons()).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull();
  });

  it('다시 열면 더 보기로 늘린 개수가 초기값으로 돌아간다', () => {
    const many = Array.from({ length: 17 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(17 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(17 - i).padStart(2, '0')}T11:00:00`,
    }));
    const { props, rerender } = renderPicker({
      reservations: many,
      category: 'ETC',
    });
    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }));
    expect(cardButtons()).toHaveLength(INITIAL_LIMIT + MORE_STEP);

    rerender(<ReservationPickerModal {...props} show={false} />);
    rerender(<ReservationPickerModal {...props} show />);

    expect(cardButtons()).toHaveLength(INITIAL_LIMIT);
  });

  it('선택된 예약이 잘린 범위 밖이면 그 항목까지 펼쳐서 연다', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...VISITED,
      reservationId: 100 + i,
      reservationStartTime: `2026-07-${String(9 - i).padStart(2, '0')}T10:00:00`,
      reservationEndTime: `2026-07-${String(9 - i).padStart(2, '0')}T11:00:00`,
    }));
    renderPicker({ reservations: many, category: 'ETC', selectedId: 108 });

    expect(cardButtons()).toHaveLength(9);
    expect(selectedCards()).toHaveLength(1);
  });
});

describe('ReservationPickerModal 상태', () => {
  it('데이터가 없고 로딩 중이면 안내만 보여준다', () => {
    renderPicker({ reservations: undefined, isPending: true });

    expect(screen.getByText(PICKER_LOADING_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체/ })).toBeNull();
  });

  it('데이터가 없고 실패하면 실패 문구와 다시 시도를 보여준다', () => {
    const { props } = renderPicker({ reservations: undefined, isError: true });

    expect(screen.getByText(PICKER_ERROR_MESSAGE)).toBeInTheDocument();
    props.refetch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(props.refetch).toHaveBeenCalledTimes(1);
  });

  it('실패했어도 캐시 목록이 있으면 목록을 그리고 배너만 얹는다', () => {
    const { props } = renderPicker({ isError: true });

    expect(cardButtons()).toHaveLength(2);
    expect(screen.getByText(PICKER_STALE_MESSAGE)).toBeInTheDocument();
    props.refetch.mockClear();
    const retry = screen.getByRole('button', { name: '다시 시도' });
    expect(retry).toHaveClass('min-h-[44px]');
    fireEvent.click(retry);
    expect(props.refetch).toHaveBeenCalledTimes(1);
  });

  it('예약이 없으면 빈 상태 안내를, 출석 유형이면 기타로 바꾸라는 힌트를 함께 보여준다', () => {
    const { unmount } = renderPicker({ reservations: [] });
    expect(screen.getByText(PICKER_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(PICKER_EMPTY_ATTENDANCE_HINT)).toBeInTheDocument();
    unmount();

    renderPicker({ reservations: [], category: 'ETC' });
    expect(screen.getByText(PICKER_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(PICKER_EMPTY_ATTENDANCE_HINT)).toBeNull();
  });
});
