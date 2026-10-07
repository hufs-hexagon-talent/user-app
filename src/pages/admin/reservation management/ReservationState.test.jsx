import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import {
  useAdminDeleteReservation,
  useChangeState,
  useExportReservationExcel,
  useReservationSearch,
  useStates,
} from '../../../api/reservation.api';
import { useAllRooms } from '../../../api/room.api';

import ReservationState from './ReservationState';

jest.mock('../../../api/reservation.api', () => ({
  useAdminDeleteReservation: jest.fn(),
  useChangeState: jest.fn(),
  useExportReservationExcel: jest.fn(),
  useReservationSearch: jest.fn(),
  useStates: jest.fn(),
}));
jest.mock('../../../api/room.api', () => ({
  useAllRooms: jest.fn(),
}));
jest.mock('../../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: jest.fn(),
    openErrorSnackbar: jest.fn(),
  }),
}));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
// 달력은 그리지 않고 받은 props 만 남긴다. 날짜 고르기는 onChange 를 직접 부른다.
const mockDatePickerProps = jest.fn();
jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: props => {
    mockDatePickerProps(props);
    return null;
  },
}));

const search = jest.fn();

const page = items => ({
  data: { items, meta: { totalPages: 1, size: 10 } },
});

const reservation = (id, start, end) => ({
  reservationId: id,
  reservationState: 'NOT_VISITED',
  roomName: '306',
  partitionNumber: 1,
  name: '홍길동',
  userId: 1,
  reservationStartTime: start,
  reservationEndTime: end,
});

const dayPicker = () =>
  mockDatePickerProps.mock.calls
    .map(([props]) => props)
    .filter(props => !props.selectsRange)
    .at(-1);

const rangePicker = () =>
  mockDatePickerProps.mock.calls
    .map(([props]) => props)
    .filter(props => props.selectsRange)
    .at(-1);

beforeEach(() => {
  jest.clearAllMocks();
  search.mockResolvedValue(page([]));
  useReservationSearch.mockReturnValue({ mutateAsync: search });
  useChangeState.mockReturnValue({ mutateAsync: jest.fn() });
  useAdminDeleteReservation.mockReturnValue({ mutate: jest.fn() });
  useStates.mockReturnValue({ data: [] });
  useAllRooms.mockReturnValue({ data: [] });
});

describe('ReservationState 하루 경계', () => {
  // 예전에는 'yyyy-MM-ddT00:00:00Z' 로 물어 [D 09:00, D+1 09:00) KST 가 됐다. 새벽 예약이 전날 목록에 떴다.
  it('고른 날의 KST 0시부터 다음 날 0시까지 묻는다', async () => {
    render(<ReservationState />);
    await waitFor(() => expect(search).toHaveBeenCalled());

    act(() => dayPicker().onChange(new Date(2026, 9, 20)));

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startDateTime: '2026-10-19T15:00:00.000Z',
          endDateTime: '2026-10-20T15:00:00.000Z',
        }),
      ),
    );
  });

  // 예전 경계는 두 날 모두 09:00 KST 였다. 종료일을 넣지 않는 범위와 파일 이름은 그대로 두고 경계만 0시로 옮긴다.
  it('엑셀 기간의 두 경계를 KST 0시로 보낸다', async () => {
    render(<ReservationState />);
    await waitFor(() => expect(search).toHaveBeenCalled());

    fireEvent.click(screen.getByText('내보내기'));
    act(() =>
      rangePicker().onChange([new Date(2026, 9, 13), new Date(2026, 9, 26)]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(useExportReservationExcel).toHaveBeenCalledWith({
      states: [],
      startDateTime: '2026-10-12T15:00:00.000Z',
      endDateTime: '2026-10-25T15:00:00.000Z',
    });
  });
});

describe('ReservationState 시각 표기', () => {
  // 오늘 날짜에 기대지 않도록 달력에서 날을 고른 뒤 본다
  const renderOn = async day => {
    render(<ReservationState />);
    await waitFor(() => expect(search).toHaveBeenCalled());
    act(() => dayPicker().onChange(day));
  };
  // 행마다 [시작 시간, 종료 시간]. 표는 시작 시각 오름차순이다.
  const timeRows = () =>
    Array.from(document.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td'))
        .slice(4, 6)
        .map(cell => cell.textContent),
    );

  it('같은 날은 HH:mm, 자정은 24:00, 다음 날에 끝나면 익일 없이 HH:mm 으로 적는다', async () => {
    search.mockResolvedValue(
      page([
        reservation(
          1,
          '2026-10-20T10:00:00+09:00',
          '2026-10-20T11:00:00+09:00',
        ),
        reservation(
          2,
          '2026-10-20T23:30:00+09:00',
          '2026-10-21T00:00:00+09:00',
        ),
        reservation(
          3,
          '2026-10-20T23:00:00+09:00',
          '2026-10-21T01:00:00+09:00',
        ),
      ]),
    );
    await renderOn(new Date(2026, 9, 20));

    await waitFor(() =>
      expect(timeRows()).toEqual([
        ['10:00', '11:00'],
        ['23:00', '01:00'],
        ['23:30', '24:00'],
      ]),
    );
    expect(document.querySelector('tbody').textContent).not.toMatch(
      /익일|전날/,
    );
  });

  // 서버는 고른 날에 걸친 예약을 준다(겹침). 날짜 열이 없어 전날 시작한 예약만 시작일을 붙인다.
  it('전날 시작해 자정을 넘긴 예약은 시작 시각 앞에 시작일을 붙인다', async () => {
    search.mockResolvedValue(
      page([
        reservation(
          1,
          '2026-10-19T23:30:00+09:00',
          '2026-10-20T01:30:00+09:00',
        ),
        reservation(
          2,
          '2026-10-20T09:00:00+09:00',
          '2026-10-20T10:00:00+09:00',
        ),
      ]),
    );
    await renderOn(new Date(2026, 9, 20));

    await waitFor(() =>
      expect(timeRows()).toEqual([
        ['10-19 23:30', '01:30'],
        ['09:00', '10:00'],
      ]),
    );
    expect(document.querySelector('tbody').textContent).not.toMatch(
      /익일|전날/,
    );
  });
});
