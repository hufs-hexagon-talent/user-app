import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useServiceRole } from '../../api/user.api';
import { useSnackbar } from 'react-simple-snackbar';
import useAuth from '../../hooks/useAuth';
import './Footer.css';

const Footer = () => {
  const [openSnackbar, closeSnackbar] = useSnackbar({
    position: 'top-right',
    style: {
      backgroundColor: '#FF3333',
    },
  });
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const { data: serviceRole } = useServiceRole();

  const handleAdminClick = async () => {
    if (loggedIn && serviceRole === 'ADMIN') {
      navigate('/manage/user-statics');
    } else {
      openSnackbar('관리자 외에는 접근 권한이 없습니다.');
      setTimeout(() => {
        closeSnackbar();
      }, 3000);
    }
  };

  return (
    <div className="w-full">
      <footer
        id="footer"
        className="text-sm bg-footermainbg relative p-0 block break-keep">
        <div className="py-6 px-2.7 ml-5 mr-5">
          <div className="footer-logo cursor-pointer">
            <a href="https://www.hufs.ac.kr/">
              <img
                className="w-50 h-10"
                src="https://computer.hufs.ac.kr/sites/computer/masterSkin/computer_JW_MS_K2WT001_M/images/logo_footer.svg"
                alt="한국외국어대학교"
              />
            </a>
          </div>
          <div className="mt-5 leading-8 text-footertextcolor">
            <p className="block mx-0 leading-2">
              <span className="text-sm inline-block font-normal">
                <b className="font-bormal text-footertextbrown">
                  글로벌캠퍼스{' '}
                </b>
                17035 경기도 용인시 처인구 모현읍 외대로 81 한국외국어대학교
                글로벌캠퍼스 (공학관 205호)
              </span>
            </p>
            <p className="block  mx-0 leading-2">
              <span className="inline-block font-normal">
                <b className="font-bormal text-footertextbrown">TEL. </b>
                031-330-4268
              </span>
              <span>
                <b className="font-bormal text-footertextbrown"> Email. </b>
                <a href="mailto:ces@hufs.ac.kr">ces@hufs.ac.kr</a>
              </span>
            </p>
            <p className="block leading-2">
              <span>
                <b className="font-bormal text-footertextbrown">
                  학부 홈페이지.{' '}
                </b>
                <a
                  className="inline hover:underline"
                  href="https://computer.hufs.ac.kr">
                  https://computer.hufs.ac.kr
                </a>
              </span>
            </p>
            {/* 이용 규칙이 상단 네비에서 마이페이지 안으로 내려가면서, 마이페이지
                라우트가 없는 계정에게는 도달할 길이 없어졌다. 비로그인 방문자,
                RESIDENT(키오스크), 비밀번호 변경이 강제된 상태가 그렇다.
                푸터는 그 세 경우에도 렌더되므로 여기에 경로를 남긴다.
                로그인 여부·역할로 감싸면 안 되는 이유가 이것이다. */}
            <p className="block">
              <button
                type="button"
                onClick={() => navigate('/notice')}
                className="mt-2 inline-block py-2 font-semibold text-white underline underline-offset-4 hover:text-footertextbrown focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-footermainbg">
                이용 규칙
              </button>
            </p>
            {loggedIn && serviceRole === 'ADMIN' && (
              <div
                onClick={handleAdminClick}
                className="inline hover:underline cursor-pointer text-gray-400 text-sm mt-3">
                관리자
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Footer;
