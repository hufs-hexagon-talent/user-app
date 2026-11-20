import { vi } from 'vitest';
const { mockNavigate, mockOpenSnackbar } = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const mockOpenSnackbar = vi.fn();
  return {
    mockNavigate,
    mockOpenSnackbar,
  };
});
import React from 'react';
import { act, render } from '@testing-library/react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import SessionExpiryWatcher from './SessionExpiryWatcher';
import { authState } from '../hooks/authState';
import { handleSessionExpired } from '../api/session';
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));
vi.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [mockOpenSnackbar, vi.fn()],
}));
vi.mock('../queryClient', () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

// 로그인 상태를 화면에 드러내, 이동이 상태 반영 뒤에 일어나는지 확인한다.
const Probe = () => {
  const auth = useRecoilValue(authState);
  return <div>{auth.isAuthenticated ? '로그인' : '비로그인'}</div>;
};
const renderWatcher = ({ loggedIn }) =>
  render(
    <RecoilRoot
      initializeState={snap =>
        snap.set(authState, {
          isAuthenticated: loggedIn,
        })
      }>
      <SessionExpiryWatcher />
      <Probe />
    </RecoilRoot>,
  );
beforeEach(() => {
  mockNavigate.mockClear();
  mockOpenSnackbar.mockClear();
});
describe('세션 만료 처리', () => {
  test('만료를 알리면 안내를 띄우고 로그인 화면으로 보낸다', async () => {
    const { getByText } = renderWatcher({
      loggedIn: true,
    });
    await act(async () => {
      handleSessionExpired();
    });
    expect(mockOpenSnackbar).toHaveBeenCalledWith(
      '로그인이 만료되었습니다. 다시 로그인해 주세요.',
      4000,
    );
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      replace: true,
    });
    // 이동 시점에는 로그인 상태가 이미 내려가 있어야 한다.
    // 아직 로그인으로 남아 있으면 라우터에 /login 라우트가 없어 * 가 / 로 덮어쓴다.
    expect(getByText('비로그인')).toBeInTheDocument();
  });
  test('로그인한 적 없는 상태의 만료 알림은 무시한다', async () => {
    renderWatcher({
      loggedIn: false,
    });
    await act(async () => {
      handleSessionExpired();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockOpenSnackbar).not.toHaveBeenCalled();
  });
  test('동시에 여러 번 알려도 한 번만 처리한다', async () => {
    renderWatcher({
      loggedIn: true,
    });
    await act(async () => {
      handleSessionExpired();
      handleSessionExpired();
      handleSessionExpired();
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockOpenSnackbar).toHaveBeenCalledTimes(1);
  });
});
