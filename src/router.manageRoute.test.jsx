import { vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';
import RouterComponent from './router';
import { authState } from './hooks/authState';

// 옛 관리자 화면(/manage)은 지웠다. 관리자 기능은 admin-app(/admin/)에 있다.
// 옛 북마크나 손으로 친 /manage 주소로 와도 빈 화면이 아니라 첫 화면으로 돌아가야 한다.
// 목킹 규약은 router.qrcheckRoute.test.jsx 와 같다.
vi.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [vi.fn(), vi.fn()],
}));
vi.mock('./api/user.api', () => ({
  useMe: () => global.__me,
  isAuthError: () => false,
  useServiceRole: () => ({
    data: global.__me?.data?.serviceRole,
  }),
}));
vi.mock('./pages/rooms/room/RoomPage', () => ({
  default: () => <div>예약 현황 화면</div>,
}));
vi.mock('./components/navbar/NavigationBar', () => ({
  default: () => null,
}));
vi.mock('./components/footer/Footer', () => ({
  default: () => null,
}));
vi.mock('./components/SessionExpiryWatcher', () => ({
  default: () => null,
}));
vi.mock('./components/ConnectionError', () => ({
  default: () => <div>연결 오류</div>,
}));
const renderAt = path => {
  window.history.pushState({}, '', path);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <RecoilRoot
      initializeState={snap =>
        snap.set(authState, {
          isAuthenticated: true,
        })
      }>
      <QueryClientProvider client={queryClient}>
        <RouterComponent />
      </QueryClientProvider>
    </RecoilRoot>,
  );
};
const me = serviceRole => ({
  data: {
    serviceRole,
    isPasswordChangeRequired: false,
  },
  status: 'success',
  error: null,
  refetch: vi.fn(),
});
describe('/manage 라우트', () => {
  it.each(['/manage', '/manage/policy', '/manage/banner/manage'])(
    '관리자가 %s 로 오면 첫 화면으로 돌아간다',
    async path => {
      global.__me = me('ADMIN');
      renderAt(path);
      await waitFor(() =>
        expect(screen.getByText('예약 현황 화면')).toBeInTheDocument(),
      );
      expect(window.location.pathname).toBe('/');
    },
  );
});
