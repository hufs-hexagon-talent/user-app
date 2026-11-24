import React, { useState, useCallback, useEffect } from 'react';
import Inko from 'inko';
import { useMyInfo } from '../../api/user.api';
import { useCheckIn } from '../../api/checkin.api';

import { convertToEnglish } from '../../api/convertToEnglish';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useSnackbar } from 'react-simple-snackbar';

const QrCheck = () => {
  const [roomId, setroomId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [reservations, setReservations] = useState([]);
  const [scannedCode, setScannedCode] = useState('');
  const [isScanDisabled, setIsScanDisabled] = useState(false);

  const { mutate: doCheckIn } = useCheckIn();
  const { data: me } = useMyInfo();
  let inko = new Inko();
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const [openSnackbar, closeSnackbar] = useSnackbar({
    position: 'top-right',
    style: {
      backgroundColor: '#FF3333',
    },
  });

  // 담당 호실은 서버가 정한다. 계정 이름으로 정하면 이름을 바꾸거나 호실이 늘 때
  // 화면은 멀쩡해 보이는데 출석만 안 되는 상태가 된다.
  useEffect(() => {
    if (!me) return;
    if (me.roomId) {
      setroomId(me.roomId);
      return;
    }
    setroomId(null);
    openSnackbar(
      '이 계정에 담당 호실이 지정되지 않았습니다. 관리자에게 알려 주세요.',
    );
    setTimeout(() => {
      closeSnackbar();
    }, 2500);
    navigate('/');
  }, [me, navigate, openSnackbar, closeSnackbar]);

  // 접근 제어는 라우트 마운트(KIOSK 만 /qrcheck 존재)가 담당한다.
  // 여기는 로그인이 풀린 경우의 방어만 남긴다.
  useEffect(() => {
    if (!loggedIn) {
      openSnackbar('로그인이 되어 있지 않습니다', 2500);
      navigate('/login');
    }
  }, [navigate, loggedIn, openSnackbar]);

  const handleQrCode = verificationCode => {
    if (isScanDisabled) return; // 스캔이 차단된 경우 함수 종료

    const lowerCaseCode = convertToEnglish(
      inko.ko2en(verificationCode).toLowerCase(),
    );

    setIsScanDisabled(true); // 스캔 차단 시작
    setTimeout(() => {
      setIsScanDisabled(false); //1초 후 스캔 차단 해제
    }, 1000);

    doCheckIn(
      {
        verificationCode: lowerCaseCode,
        roomId: roomId,
      },
      {
        onSuccess: result => {
          const checkedInReservations =
            result.data.reservationInfoResponses.reservationInfoResponses;

          setReservations(prevReservations =>
            prevReservations.map(reservation =>
              checkedInReservations.some(
                checkedInReservation =>
                  checkedInReservation.reservationId ===
                  reservation.reservationId,
              )
                ? { ...reservation, state: 'VISITED' }
                : reservation,
            ),
          );

          const userName = checkedInReservations[0].name;
          setSuccessMessage(`${userName}님, 출석 확인 되었습니다.`);
          setErrorMessage('');
          setTimeout(() => {
            setSuccessMessage('');
          }, 5000);
        },
        onError: error => {
          // 인증 관련 서버 메시지(예: "쿠키에 refreshToken 이 없습니다")는
          // 사용자가 이해할 수 없으므로 그대로 노출하지 않는다.
          setErrorMessage(
            error.response?.status === 401
              ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
              : error.response?.data?.message ||
                  '출석 확인 중 오류가 발생했습니다.',
          );
          setSuccessMessage('');
          setTimeout(() => {
            setErrorMessage('');
          }, 5000);
        },
      },
    );
  };

  const handleQrKeyDown = useCallback(
    e => {
      if (e.code === 'Enter') {
        handleQrCode(scannedCode);
        setScannedCode('');
      } else {
        setScannedCode(prev => prev + e.key);
      }
    },
    [roomId, scannedCode],
  );

  useEffect(() => {
    const handleKeyPress = e => {
      if (e.target.tagName !== 'INPUT') {
        handleQrKeyDown(e);
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, [handleQrKeyDown]);

  return (
    <div className="pb-10">
      <h3 className="flex justify-center w-screen text-2xl text-center mt-20 mb-5">
        QR코드 출석
      </h3>
      <div className="mt-5 mb-10 text-center" style={{ color: '#9D9FA2' }}>
        <p>
          현재 선택된 호실 :{' '}
          {me?.roomName ? me.roomName + '호' : '선택된 호실이 없음'}
        </p>

        <p>본인의 QR코드를 스캐너에 스캔해주세요</p>
      </div>

      <div className="flex flex-col items-center justify-center w-screen">
        <input
          onKeyDown={handleQrKeyDown}
          className="flex items-center mt-1 border border-gray-300 p-2 rounded"
          type="text"
          disabled
          placeholder="Scan QR Code"></input>
        <div className="flex flex-col items-center mt-4">
          {successMessage && (
            <div className="p-4 bg-green-100 text-green-700">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="p-4 bg-red-100 text-red-700">{errorMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrCheck;
