import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, SESSION_EXPIRED_MESSAGE } from './client';
import { queryClient } from '../queryClient';
import { PASSWORD_RULE_MESSAGE } from '../pages/password/passwordRule';

// 자신의 정보 조회. 로그인 여부 판정(부팅 복원)까지 겸하는 단일 소스라
// 에러를 삼키지 않는다. 삼키면 401(비로그인)과 네트워크 순단(로그인 유지)을
// 구분할 수 없어 서버 순단 때 로그인 사용자를 로그아웃으로 오판하게 된다.
// 8초 × 3회 + 재시도 간격 0.5초 × 2 = 최대 약 25초
export const ME_TIMEOUT_MS = 8000;
export const ME_RETRY_DELAY_MS = 500;

export const fetchMe = async () => {
  // 부팅 복원은 이 응답을 기다려야 화면이 열린다. 공통 타임아웃(15초)으로
  // 재시도까지 돌면 약 48초를 스피너만 보게 되어 짧게 끊는다.
  const me_res = await apiClient.get('/users/me', { timeout: ME_TIMEOUT_MS });
  const me = me_res.data.data;
  // 이전 API 슬롯에서 복원한 세션에도 같은 출석 메뉴를 제공한다.
  return me?.serviceRole === 'RESIDENT' ? { ...me, serviceRole: 'KIOSK' } : me;
};

// 인증 오류가 401/403 으로만 오지 않는다. 토큰의 사용자를 못 찾으면 404(USER-001),
// 토큰 서명·형식이 깨졌으면 400(AUTH-008 등)이 온다. 상태 코드만 보면 이런 응답이
// 서버 장애로 분류돼 앱 전체가 연결 오류 화면에 잠기고, 쿠키가 HttpOnly 라
// 학생이 스스로 빠져나오지 못한다. 그래서 응답 본문의 에러 코드도 같이 본다.
export const isAuthError = error => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return true;

  // AUTH-015~018 같은 5xx 는 인증 서버 장애라 재시도해 볼 여지가 있으니 4xx 만 본다.
  if (!(status >= 400 && status < 500)) return false;

  const code = error?.response?.data?.code;
  return (
    typeof code === 'string' &&
    (code.startsWith('AUTH-') || code === 'USER-001')
  );
};

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    // 401 은 다시 물어도 결과가 같다. 네트워크 오류만 재시도한다.
    retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
    retryDelay: ME_RETRY_DELAY_MS,
    // 에러(비로그인) 상태에서 새 화면이 구독할 때마다 재조회하면
    // 에러가 잠시 지워져 라우터 게이트가 로더로 되돌아가고,
    // 마운트와 재조회가 무한 반복된다. 붙을 때는 다시 묻지 않는다.
    retryOnMount: false,
  });

export const useMyInfo = () => useMe();

// 관리자인지 아닌지. useMe 와 같은 캐시를 공유한다.
export const useServiceRole = () => {
  const { data: me, ...rest } = useMe();
  return { ...rest, data: me?.serviceRole };
};

// 비밀번호 변경 실패를 학생용 문구로 바꾼다. 응답이 없으면(네트워크·타임아웃)
// axios 영문 원문("Network Error")이 화면에 가지 않도록 여기서 막는다.
// 4xx 는 서버 원문 대신 에러 코드로 매핑한다. 세션 만료는 인터셉터가 이미
// 재로그인 안내로 바꿔 두었으니 그 문구를 그대로 쓴다.
// CLIENT-001 은 요청 검증 실패다. 이 요청에서 걸릴 수 있는 것은 새 비밀번호 규칙뿐이라
// 서버 원문(errors[].message) 대신 규칙을 그대로 알려 준다.
const PASSWORD_CHANGE_ERROR_MESSAGES = {
  'USER-006': '현재 비밀번호가 맞지 않습니다. 다시 확인해 주세요.',
  'USER-007': '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
  'CLIENT-001': PASSWORD_RULE_MESSAGE,
};

export const passwordChangeErrorMessage = error => {
  if (!error?.response) {
    return '서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.';
  }
  if (error.sessionExpired) return SESSION_EXPIRED_MESSAGE;
  if (error.response.status >= 500) {
    return '서버에 문제가 있어 비밀번호를 변경하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
  }
  return (
    PASSWORD_CHANGE_ERROR_MESSAGES[error.response.data?.code] ||
    '비밀번호 변경에 실패했습니다. 다시 시도해 주세요.'
  );
};

// 로그인 된 상태에서 비밀번호 수정
export const usePassword = () => {
  return useMutation({
    mutationFn: async ({ prePassword, newPassword }) => {
      try {
        const password_res = await apiClient.put('/users/me/password', {
          prePassword,
          newPassword,
        });
        return password_res.data;
      } catch (error) {
        throw new Error(passwordChangeErrorMessage(error));
      }
    },
  });
};

// 로그아웃 상태에서 비밀번호 수정
export const useLoggedOutPassword = () => {
  return useMutation({
    mutationFn: async ({ token, newPassword }) => {
      const loggedOutPW_res = await apiClient.post('/users/reset-password', {
        token,
        newPassword,
      });
      return loggedOutPW_res.data;
    },
  });
};

// 자신의 블락 기간 조회
// 제한 상태가 아닌 학생에게는 400(USER-009) 이 온다. 이건 오류가 아니라 "제한 없음" 이다.
// react-query v5 는 queryFn 이 undefined 를 돌려주면 오류로 다루므로 null 로 돌려준다.
// 그 밖의 실패는 그대로 던져 화면이 조회 실패를 알 수 있게 한다.
export const fetchBlockedPeriod = async () => {
  try {
    const blockedPreiod_res = await apiClient.get('/users/me/blocked-period');
    return blockedPreiod_res.data;
  } catch (error) {
    if (error?.response?.data?.code === 'USER-009') {
      return null;
    }
    throw error;
  }
};

export const useBlockedPeriod = ({ enabled = true } = {}) => {
  return useQuery({
    queryKey: ['blockedPeriod'],
    queryFn: fetchBlockedPeriod,
    enabled,
  });
};

// 로그인 후, 자신의 이메일 수정 요청
export const useNewEmailSend = () => {
  return useMutation({
    mutationFn: async ({ password, newEmail }) => {
      const newEmailSend_res = await apiClient.post('/users/me/mail/send', {
        password,
        newEmail,
      });
      return newEmailSend_res.data;
    },
  });
};

// 로그인 후, 인증 코드 검증 후, 이메일 수정 처리
export const useNewEmailVerify = () => {
  return useMutation({
    mutationFn: async ({ verificationId, verifyCode }) => {
      const newEmailVerify_res = await apiClient.post('/users/me/mail/verify', {
        verificationId,
        verifyCode,
      });
      return newEmailVerify_res.data;
    },
    onSuccess: () => {
      // 마이페이지가 캐시(staleTime 60초)의 이전 이메일을 보여주지 않도록 갱신한다
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
};
