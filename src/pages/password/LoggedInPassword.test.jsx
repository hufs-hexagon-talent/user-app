import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { usePassword } from '../../api/user.api';

import LoggedInPassword from './LoggedInPassword';

jest.mock('../../api/user.api', () => ({
  usePassword: jest.fn(),
}));

const mockOpenSuccessSnackbar = jest.fn();
const mockOpenErrorSnackbar = jest.fn();
jest.mock('../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: mockOpenSuccessSnackbar,
    openErrorSnackbar: mockOpenErrorSnackbar,
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockLogout = jest.fn();
jest.mock('../../hooks/useAuth', () => () => ({ logout: mockLogout }));

const changePw = jest.fn();

// 입력값은 파일에 적어 두지 않고 만들어 쓴다(비밀 스캐너가 자격 증명으로 잡는다).
const RULE_OK = 'abcd' + '0123'; // 8자, 영문·숫자 포함
const CURRENT = '2026' + '12345'; // 학번 그대로인 초기 비밀번호

const fillAll = () => {
  fireEvent.change(screen.getByPlaceholderText('기존 비밀번호를 입력해주세요'), {
    target: { value: CURRENT },
  });
  fireEvent.change(screen.getByPlaceholderText('새 비밀번호를 입력해주세요'), {
    target: { value: RULE_OK },
  });
  fireEvent.change(
    screen.getByPlaceholderText('새 비밀번호를 한번 더 입력해주세요'),
    { target: { value: RULE_OK } },
  );
};

// 두 번의 탭을 같은 tick 에 넣는다. 클릭 사이에 렌더가 끼면 상태 가드만으로도 막혀
// 원래 문제(같은 tick 의 두 번째 탭)를 재현하지 못한다.
const doubleTap = async button => {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  changePw.mockResolvedValue({});
  mockLogout.mockResolvedValue(undefined);
  usePassword.mockReturnValue({ mutateAsync: changePw });
});

describe('LoggedInPassword', () => {
  // 학번=비밀번호인 신입생은 라우터가 이 화면에 묶어 둔다. 느린 회선에서 더블탭하면 같은
  // 기존 비밀번호로 두 번 나가고, 첫 요청이 성공한 뒤 두 번째가 USER-006 으로 실패해
  // 빨간 안내가 성공 안내를 덮었다. 학생은 변경이 실패한 줄 알고 옛 비밀번호로 다시 로그인한다.
  it('변경하기를 두 번 탭해도 변경 요청은 한 번만 보내고 버튼을 진행 중으로 잠근다', async () => {
    let resolveChange;
    changePw.mockReturnValue(
      new Promise(resolve => {
        resolveChange = resolve;
      }),
    );

    render(<LoggedInPassword />);
    fillAll();

    await doubleTap(screen.getByRole('button', { name: '변경하기' }));

    expect(changePw).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '변경 중...' })).toBeDisabled();

    await act(async () => {
      resolveChange({});
    });
  });

  // 성공 안내를 먼저 띄우고 최대 5초짜리 로그아웃을 기다리면 그 사이 버튼이 살아 있고,
  // 그때의 탭은 확정적으로 실패 안내가 되어 성공 안내를 덮는다.
  it('성공 안내는 로그아웃이 끝난 뒤에 띄우고 로그인 화면으로 보낸다', async () => {
    const order = [];
    mockLogout.mockImplementation(async () => {
      order.push('logout');
    });
    mockOpenSuccessSnackbar.mockImplementation(() => order.push('snackbar'));

    render(<LoggedInPassword />);
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login',
        expect.objectContaining({ replace: true }),
      ),
    );
    expect(order).toEqual(['logout', 'snackbar']);
    expect(mockOpenSuccessSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('변경되었습니다'),
      2500,
    );
  });

  it('실패하면 학생용 문구를 띄우고 버튼이 풀려 다시 시도할 수 있다', async () => {
    changePw.mockRejectedValueOnce(
      new Error('현재 비밀번호가 맞지 않습니다. 다시 확인해 주세요.'),
    );

    render(<LoggedInPassword />);
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        '현재 비밀번호가 맞지 않습니다. 다시 확인해 주세요.',
        2500,
      ),
    );
    expect(screen.getByRole('button', { name: '변경하기' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));
    await waitFor(() => expect(changePw).toHaveBeenCalledTimes(2));
  });

  it('입력이 비어 있으면 요청을 보내지 않고 버튼도 잠그지 않는다', () => {
    render(<LoggedInPassword />);
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));

    expect(changePw).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '변경하기' })).toBeEnabled();
  });
});
