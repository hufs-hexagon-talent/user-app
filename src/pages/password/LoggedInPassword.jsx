import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Label, TextInput } from 'flowbite-react';
import { usePassword } from '../../api/user.api';
import { useCustomSnackbars } from '../../components/snackbar/SnackBar';
import './LoggedInPassword.css';
import useAuth from '../../hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';
import { PASSWORD_RULE_TEXT, validateNewPassword } from './passwordRule';

const LoggedInPassword = () => {
  const [prePassword, setPrePassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [changing, setChanging] = useState(false);
  // 상태는 다음 렌더에서야 바뀐다. 같은 tick 의 두 번째 탭까지 막으려면 동기 값이어야 한다.
  const changingRef = useRef(false);

  // 보기/가리기 토글 상태
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { mutateAsync: changePw } = usePassword();
  const navigate = useNavigate();
  const { openSuccessSnackbar, openErrorSnackbar } = useCustomSnackbars();
  const { logout } = useAuth();

  const handleSubmit = async e => {
    e.preventDefault();

    // 모든 필드 체크
    if (!prePassword || !newPassword || !confirmPassword) {
      openErrorSnackbar('모든 값을 입력해주세요');
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = '신규 비밀번호가 일치하지 않습니다.';
      setPasswordError(msg);
      openErrorSnackbar(msg);
      return;
    }
    // 서버가 규칙을 어긴 비밀번호를 400 으로 되돌린다. 보내기 전에 같은 규칙으로 걸러
    // 학생이 이유를 모른 채 같은 값으로 다시 시도하는 일을 막는다.
    const ruleError = validateNewPassword(newPassword);
    if (ruleError) {
      setNewPasswordError(ruleError);
      openErrorSnackbar(ruleError);
      return;
    }

    setNewPasswordError('');
    setPasswordError('');
    // 더블탭하면 같은 기존 비밀번호로 두 번 나가고, 첫 요청이 성공한 뒤 두 번째가 USER-006 으로
    // 실패해 성공 안내를 실패 안내로 덮는다. 학생은 변경이 실패한 줄 알고 옛 비밀번호로 다시
    // 로그인한다. 래치는 검증을 통과한 뒤, 요청 직전에 건다(LoggedOutPassword 와 같은 순서).
    if (changingRef.current) return;
    changingRef.current = true;
    setChanging(true);
    try {
      await changePw({ prePassword, newPassword });

      // 서버 로그아웃(쿠키 만료)까지 끝낸 뒤 안내하고 이동한다. 안내를 먼저 띄우면 로그아웃이
      // 끝날 때까지(최대 5초) 성공 안내 옆에 버튼이 남는다. 로그아웃 실패를
      // 비밀번호 변경 실패로 오표시하지 않도록 여기서 따로 처리한다.
      try {
        await logout();
      } catch (logoutError) {
        console.error('Failed to logout after password change:', logoutError);
      }

      openSuccessSnackbar(
        '비밀번호가 성공적으로 변경되었습니다. 재로그인 부탁드립니다.',
        2500,
      );
      // 자동 리다이렉트 회피
      navigate('/login', { replace: true, state: { fromLogout: true } });
    } catch (error) {
      console.error('Failed to change password:', error);
      openErrorSnackbar(
        error?.message ?? '비밀번호 변경에 실패했습니다.',
        2500,
      );
    } finally {
      changingRef.current = false;
      setChanging(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mt-10 text-2xl mb-4">비밀번호 변경</div>
      <form
        id="form"
        className="flex flex-col max-w-md w-full gap-4"
        onSubmit={handleSubmit}>
        <div>
          <div className="mb-2 block">
            <Label htmlFor="password1" value="기존 비밀번호" />
          </div>
          <div className="relative with-eye">
            <TextInput
              id="password1"
              type={showOld ? 'text' : 'password'}
              placeholder="기존 비밀번호를 입력해주세요"
              required
              autoComplete="current-password"
              onChange={e => setPrePassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showOld ? '비밀번호 숨기기' : '비밀번호 보기'}
              onClick={() => setShowOld(v => !v)}
              className="absolute inset-y-0 right-3 flex items-center">
              {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* 새 비밀번호 */}
        <div>
          <div className="mb-2 block">
            <Label htmlFor="newPassword" value="새 비밀번호" />
          </div>
          <div className="relative with-eye">
            <TextInput
              id="newPassword"
              type={showNew ? 'text' : 'password'}
              placeholder="새 비밀번호를 입력해주세요"
              required
              autoComplete="new-password"
              onChange={e => {
                setNewPassword(e.target.value);
                setNewPasswordError('');
              }}
              color={passwordError || newPasswordError ? 'failure' : undefined}
              helperText={newPasswordError || PASSWORD_RULE_TEXT}
            />
            <button
              type="button"
              aria-label={showNew ? '비밀번호 숨기기' : '비밀번호 보기'}
              onClick={() => setShowNew(v => !v)}
              className="absolute inset-y-0 right-3 flex items-center">
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* 새 비밀번호 확인 */}
        <div>
          <div className="mb-2 block">
            <Label htmlFor="confirmPassword" value="새 비밀번호 확인" />
          </div>
          <div className="relative with-eye">
            <TextInput
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="새 비밀번호를 한번 더 입력해주세요"
              required
              autoComplete="new-password"
              onChange={e => {
                setConfirmPassword(e.target.value);
                setPasswordError('');
              }}
              color={passwordError ? 'failure' : undefined}
              helperText={passwordError || undefined}
            />
            <button
              type="button"
              aria-label={showConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}
              onClick={() => setShowConfirm(v => !v)}
              className="absolute inset-y-0 right-3 flex items-center">
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button
          className="mt-10 mb-10"
          color="dark"
          type="submit"
          disabled={changing}>
          {changing ? '변경 중...' : '변경하기'}
        </Button>
      </form>
    </div>
  );
};

export default LoggedInPassword;
