import { vi } from 'vitest';
const { mockOpenSuccessSnackbar, mockOpenErrorSnackbar, mockNavigate } =
  vi.hoisted(() => {
    const mockOpenSuccessSnackbar = vi.fn();
    const mockOpenErrorSnackbar = vi.fn();
    const mockNavigate = vi.fn();
    return {
      mockOpenSuccessSnackbar,
      mockOpenErrorSnackbar,
      mockNavigate,
    };
  });
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useNewEmailSend, useNewEmailVerify } from '../../api/user.api';
import EmailSend from './EmailSend';
vi.mock('../../api/user.api', () => ({
  useNewEmailSend: vi.fn(),
  useNewEmailVerify: vi.fn(),
}));
vi.mock('../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: mockOpenSuccessSnackbar,
    openErrorSnackbar: mockOpenErrorSnackbar,
  }),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));
const doEmailSend = vi.fn();
const doEmailVerify = vi.fn();

// 두 번의 탭을 같은 tick 에 넣는다. 클릭 사이에 렌더가 끼면 상태 가드만으로도 막혀
// 원래 문제(같은 tick 의 두 번째 탭)를 재현하지 못한다.
const doubleTap = async button => {
  await act(async () => {
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
      }),
    );
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
      }),
    );
  });
};
const httpError = (status, code) => ({
  response: {
    status,
    headers: {},
    data: {
      code,
      message: '해당 키는 존재하지 않습니다.',
    },
  },
});
const sendCode = async () => {
  fireEvent.change(screen.getByPlaceholderText('비밀번호 입력'), {
    target: {
      value: 'pw',
    },
  });
  fireEvent.change(screen.getByPlaceholderText('새 이메일 입력'), {
    target: {
      value: 'a@hufs.ac.kr',
    },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', {
        name: '인증 코드 발송',
      }),
    );
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  doEmailSend.mockResolvedValue({
    data: {
      verificationId: 'v-1',
    },
  });
  doEmailVerify.mockResolvedValue({});
  useNewEmailSend.mockReturnValue({
    mutateAsync: doEmailSend,
  });
  useNewEmailVerify.mockReturnValue({
    mutateAsync: doEmailVerify,
  });
});
afterEach(() => {
  vi.useRealTimers();
});
describe('EmailSend', () => {
  it('확인을 두 번 탭해도 인증 코드 확인은 한 번만 보낸다', async () => {
    let resolveVerify;
    doEmailVerify.mockReturnValue(
      new Promise(resolve => {
        resolveVerify = resolve;
      }),
    );
    render(<EmailSend />);
    await sendCode();
    await doubleTap(
      screen.getByRole('button', {
        name: '확인',
      }),
    );
    expect(doEmailVerify).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', {
        name: '확인 중...',
      }),
    ).toBeDisabled();
    await act(async () => {
      resolveVerify({});
    });
  });
  it('확인 실패는 서버 원문 대신 학생용 문구를 띄운다', async () => {
    doEmailVerify.mockRejectedValue(httpError(404, 'REDIS-001'));
    render(<EmailSend />);
    await sendCode();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: '확인',
        }),
      );
    });
    await waitFor(() => expect(mockOpenErrorSnackbar).toHaveBeenCalled());
    const [message] = mockOpenErrorSnackbar.mock.calls[0];
    expect(message).toBe(
      '인증 코드가 만료되었거나 아직 발송하지 않았습니다. 인증 코드를 다시 받아 주세요.',
    );
    expect(message).not.toContain('해당 키는 존재하지 않습니다');
  });
  it('발송 실패도 서버 원문을 띄우지 않는다', async () => {
    doEmailSend.mockRejectedValue(httpError(400, 'CLIENT-001'));
    render(<EmailSend />);
    await sendCode();
    await waitFor(() => expect(mockOpenErrorSnackbar).toHaveBeenCalled());
    expect(mockOpenErrorSnackbar.mock.calls[0][0]).toBe(
      '새 이메일 주소 형식을 확인해 주세요.',
    );
  });
  it('재발송 잠금은 서버 쿨다운과 같은 60초다', async () => {
    vi.useFakeTimers();
    render(<EmailSend />);
    await sendCode();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // 300초였다면 5:00 이 보인다
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });
});
